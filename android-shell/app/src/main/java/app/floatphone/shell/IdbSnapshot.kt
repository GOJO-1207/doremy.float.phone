package app.floatphone.shell

import android.content.Context
import android.util.Log
import java.io.File
import java.util.concurrent.Executors

/**
 * IndexedDB 快照 —— 2026-11-14 数据丢失事故后的保护层。
 *
 * 事故定性：WebView 的 IndexedDB（LevelDB）在 I/O 饱和 / 进程被杀后损坏，
 * Chromium 会直接丢弃损坏库并重建一个空库，页面读到空库就按"新用户"渲染，
 * 用户看到的就是「什么都没做，数据没了、界面变新手机」。壳层里没有任何
 * 删库调用，所以只能靠外部留一份可回滚的副本。
 *
 * 策略（对应方案里的 5 条）：
 * 1. 启动时、WebView 初始化之前先做「空库检测」，只有「本地为空 且 有可用快照」
 *    才自动回滚；其余情况只记录，不覆盖。
 * 2. 快照本体在后台线程增量同步到 files/idb-snapshot 下，A/B 两份轮换，
 *    永远保留上一份完整快照；失败静默跳过，绝不阻塞启动。
 * 3. 路径一律按 context.applicationInfo.dataDir 现算，不写死包名 ——
 *    二改壳（app.floatphone.shell）与原版壳（app.floatphone.shell.gojo）
 *    各自有自己的 dataDir，互不影响。
 */
object IdbSnapshot {
    private const val TAG = "IdbSnapshot"
    private const val SNAPSHOT_DIR = "idb-snapshot"
    private const val SLOT_A = "A"
    private const val SLOT_B = "B"
    private const val STAMP_FILE = ".stamp"

    private val executor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "idb-snapshot").apply {
            isDaemon = true
            priority = Thread.MIN_PRIORITY
        }
    }

    /** WebView 默认 profile 的 IndexedDB 目录。 */
    fun indexedDbDir(context: Context): File =
        File(context.applicationInfo.dataDir, "app_webview/Default/IndexedDB")

    /**
     * 必须在 `WebView(this)` 之前调用，确保 Chromium 还没打开 LevelDB。
     * 同步部分只做 stat 级检查（毫秒级）；真正的复制交给后台线程。
     */
    fun prepareBeforeWebView(context: Context) {
        val live = indexedDbDir(context)
        try {
            if (looksEmpty(live)) {
                val snapshot = newestUsableSnapshot(context)
                if (snapshot != null) {
                    Log.w(TAG, "本地 IndexedDB 为空，从快照回滚：" + snapshot.absolutePath)
                    if (live.exists() && !live.deleteRecursively()) {
                        Log.w(TAG, "删除空库目录失败，放弃回滚")
                    } else {
                        live.parentFile?.mkdirs()
                        if (copyTree(snapshot, live)) {
                            Log.i(TAG, "回滚完成：" + live.absolutePath)
                        } else {
                            Log.w(TAG, "回滚复制失败，保持空库")
                        }
                    }
                } else {
                    Log.w(TAG, "本地 IndexedDB 为空且无可用快照，按新用户继续")
                }
            }
        } catch (t: Throwable) {
            Log.w(TAG, "启动检测失败，静默跳过", t)
        }

        // 后台做快照：不阻塞启动，失败也不影响本次运行。
        executor.execute {
            try {
                syncSnapshot(context, live)
            } catch (t: Throwable) {
                Log.w(TAG, "快照同步失败，静默跳过", t)
            }
        }
    }

    /**
     * 空库判定：目录不存在、或者没有 LevelDB 的关键文件（CURRENT / *.ldb / *.log），
     * 或者总字节数为 0。缺 CURRENT 说明库还没初始化完或已被重建。
     */
    private fun looksEmpty(dir: File): Boolean {
        if (!dir.exists() || !dir.isDirectory) return true
        var bytes = 0L
        var levelFiles = 0
        dir.walkTopDown().forEach { file ->
            if (file.isFile) {
                bytes += file.length()
                val name = file.name.lowercase()
                if (name == "current" || name.endsWith(".ldb") || name.endsWith(".log")) levelFiles++
            }
        }
        return bytes <= 0L || levelFiles == 0
    }

    private fun snapshotRoot(context: Context): File =
        File(context.filesDir, SNAPSHOT_DIR)

    private fun slotDir(context: Context, slot: String): File =
        File(snapshotRoot(context), slot)

    private fun newestUsableSnapshot(context: Context): File? {
        val candidates = listOf(slotDir(context, SLOT_A), slotDir(context, SLOT_B))
            .filter { it.isDirectory && File(it, STAMP_FILE).isFile && !looksEmpty(it) }
        return candidates.maxByOrNull { stampOf(it) }
    }

    private fun stampOf(dir: File): Long =
        try {
            File(dir, STAMP_FILE).readText().trim().toLongOrNull() ?: 0L
        } catch (t: Throwable) {
            0L
        }

    /**
     * 增量同步到「较旧」的那份槽位，保证正在写的这份即使中途失败，
     * 另一份仍是完整的，随时可回滚。
     */
    private fun syncSnapshot(context: Context, live: File) {
        if (!live.exists() || looksEmpty(live)) return
        val a = slotDir(context, SLOT_A)
        val b = slotDir(context, SLOT_B)
        val target = when {
            !a.exists() -> a
            !b.exists() -> b
            stampOf(a) <= stampOf(b) -> a
            else -> b
        }
        target.mkdirs()
        // 先删掉残留的旧 stamp：写一半崩溃时不会被误判为一份完整快照。
        File(target, STAMP_FILE).delete()
        if (!syncTree(live, target)) {
            Log.w(TAG, "快照同步未完成：" + target.absolutePath)
            return
        }
        File(target, STAMP_FILE).writeText(System.currentTimeMillis().toString())
        Log.i(TAG, "快照完成：" + target.absolutePath)
        trimOldSlots(context, keep = target)
    }

    private fun trimOldSlots(context: Context, keep: File) {
        listOf(slotDir(context, SLOT_A), slotDir(context, SLOT_B))
            .filter { it != keep && it.exists() }
            .forEach { dir ->
                val stamps = listOf(dir, keep).map { stampOf(it) }
                // 只保留最近两份：另一槽位本来就只是「上一份」，无需删除。
                if (stamps.any { it <= 0L } && dir.exists()) dir.deleteRecursively()
            }
    }

    /** 全量复制（回滚用）。 */
    private fun copyTree(src: File, dst: File): Boolean = try {
        dst.mkdirs()
        src.walkTopDown().forEach { file ->
            val target = File(dst, file.relativeTo(src).path)
            if (file.isDirectory) {
                target.mkdirs()
            } else if (file.isFile) {
                target.parentFile?.mkdirs()
                file.copyTo(target, overwrite = true)
            }
        }
        true
    } catch (t: Throwable) {
        Log.w(TAG, "复制失败：" + src.absolutePath, t)
        false
    }

    /** 增量镜像：补齐缺失/变化的文件，删掉源里已不存在的文件。 */
    private fun syncTree(src: File, dst: File): Boolean = try {
        var ok = true
        dst.mkdirs()
        src.walkTopDown().forEach { file ->
            val target = File(dst, file.relativeTo(src).path)
            if (file.isDirectory) {
                target.mkdirs()
            } else if (file.isFile) {
                val needsCopy = !target.isFile || target.length() != file.length() ||
                    target.lastModified() != file.lastModified()
                if (needsCopy) {
                    target.parentFile?.mkdirs()
                    file.copyTo(target, overwrite = true)
                    target.setLastModified(file.lastModified())
                }
            }
        }
        dst.walkBottomUp().forEach { file ->
            val rel = file.relativeTo(dst).path
            if (rel == STAMP_FILE) return@forEach
            val existsInSrc = File(src, rel).exists()
            if (!existsInSrc && file.isFile) file.delete()
        }
        ok
    } catch (t: Throwable) {
        Log.w(TAG, "增量同步失败", t)
        false
    }
}

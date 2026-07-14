directory = 根目录:
choose-dir = 
    .label = 选择…
setting = 设置

source-title = 源路径
source-intro = <附加新文件> 会从该目录检索最近添加的文件并附加到 Zotero 条目/分类下。

read-pdf-title = 从PDF读取标题
readPDFtitle-never =
    .label = 永不
readPDFtitle-nonCJK =
    .label = 仅限外文
readPDFtitle-always =
    .label = 始终

attach-title = 附加类型
attach-intro = 若使用 Zotero 官方或 WebDAV 同步，请选择作为 <副本>；若使用第三方同步，如坚果云、OneDrive等，请选择作为 <链接> 并认真配置 <靶路径>，文件将会被移动到靶路径下后作为链接类型附件导入 Zotero。
attach-type-start = 文件作为
attach-type-end = 附加到 Zotero 的条目/分类下
importing =
    .label = 副本
linking =
    .label = 链接

dest-title = 靶路径
dest-intro = <移动附件> 会将附件移动到该路径下，文件最终路径为 <根目录/子目录/文件名>。若无需 <子目录> 留空即可。
subfolder = 子目录:

slash-as-subfolder-delimiter =
    .label = 将变量中的正斜杠 (/) 解析为子文件夹分隔符

filename = 文件名:

other-title = 其他设置
auto-rename = 
    .label = 自动重命名添加的附件
auto-rename-on-modify =
    .label = 条目信息变更时自动重命名已链接附件
auto-rename-on-modify-help =
    .tooltiptext = 为什么开启：Zotero 通常只在添加附件时重命名；之后修改标题、作者、年份或 Better BibTeX citation key，已有链接附件可能仍保留旧文件名。若希望链接文件名自动同步，请开启；偏好手动重命名则保持关闭。
    .aria-label = 自动重命名已链接附件说明
auto-rename-on-modify-debounce =
    .label = 编辑后重命名防抖（毫秒）
auto-rename-on-modify-debounce-help =
    .tooltiptext = 为什么需要：一次编辑可能连续产生多次修改通知，不防抖会重复重命名。数值表示最后一次修改后等待多久；推荐 1000 毫秒。仍重复可调至 1500–3000 毫秒，追求响应速度可尝试 300–500 毫秒。
    .aria-label = 防抖说明
auto-rename-on-modify-delay =
    .label = 编辑后重命名延迟（毫秒）
auto-rename-on-modify-delay-help =
    .tooltiptext = 为什么需要：Zotero 或 Better BibTeX 可能异步更新标题、作者、年份或 citation key，立即重命名会读取旧值。数值表示防抖结束后额外等待多久；建议 300–1000 毫秒。仍读到旧值可增至 1500–3000 毫秒；没有旧值问题可关闭。
    .aria-label = 延迟说明
auto-move = 
    .label = 自动移动添加的附件
auto-remove-empty-folder = 
    .label = 自动删除移动后为空的文件夹
move-without-deleting = 
    .label = 保留原始文件，不删除源文件，移动操作变为复制（移动/匹配/附加均生效）
file-types = 重命名/移动的附件类型
filename-as-prefix-rules = 符合下面命名规则时，在重命名时原文件名会被保留作为前缀
filename-rules-instructions = 请使用正则表达式，多个表达式用 “,” 分隔
filename-skip-rename-rules = 符合下面命名规则时，不进行重命名
filename-skip-auto-move-rename-rules = 符合下面命名规则时，不进行自动移动或重命名
about-title = 关于
about-intro = Attanger 是 Attachment Manager 的缩写，本项目大量参考了 Zotero 6 版本的 ZotFile 插件。


preferences-file-renaming-customize-button =
    .label = 设置重命名规则…

preferences-file-renaming-format-instructions-more = 阅读<label data-l10n-name="file-renaming-format-help-link">文档</label>获取更多帮助。

attach-new-file-shortcut =
    .label = 附加新文件快捷键
match-attachment-shortcut =
    .label = 匹配附件快捷键
rename-attachment-shortcut =
    .label = 重命名附件快捷键
rename-move-attachment-shortcut =
    .label = 重命名并移动/复制附件快捷键
move-attachment-shortcut =
    .label = 移动/复制附件快捷键
sync-attachment-title = 
    .label = 重命名后同步修改附件标题

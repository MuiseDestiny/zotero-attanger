directory = 根目录:
choose-dir =
    .label = 选择…
setting = 设置

read-pdf-title = 从 PDF 读取标题
readPDFtitle-never =
    .label = 永不
readPDFtitle-nonCJK =
    .label = 仅限外文
readPDFtitle-always =
    .label = 始终

subfolder = 子目录
slash-as-subfolder-delimiter =
    .label = 将变量中的正斜杠 (/) 解析为子文件夹分隔符

auto-rename =
    .label = 自动重命名添加的附件
auto-recognize-imported-pdf =
    .label = 识别独立导入 PDF 的文献信息
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
    .label = 自动移动新添加的附件到文件保存目录
auto-remove-empty-folder =
    .label = 自动删除移动后为空的文件夹
move-without-deleting =
    .label = 保留链接附件的原始文件（移动变为复制）
delete-source-after-import =
    .label = 附加或匹配成功后删除下载文件夹中的源文件
file-types = 重命名/移动的附件类型
filename-as-prefix-rules = 符合下面命名规则时，在重命名时原文件名会被保留作为前缀
filename-rules-instructions = 请使用正则表达式，多个表达式用 “,” 分隔
filename-skip-rename-rules = 符合下面命名规则时，不进行重命名
filename-skip-auto-move-rename-rules = 符合下面命名规则时，不进行自动移动、复制或重命名
about-title = 关于
about-intro = Attanger 是 Attachment Manager 的缩写，本项目大量参考了 Zotero 6 版本的 ZotFile 插件。
about-pro-plugins = 更多插件

preferences-file-renaming-customize-button =
    .label = 设置重命名规则…

attach-new-file-shortcut =
    .label = 附加新文件
match-attachment-shortcut =
    .label = 匹配附件
rename-attachment-shortcut =
    .label = 重命名附件
rename-move-attachment-shortcut =
    .label = 重命名并移动/同步附件
move-attachment-shortcut =
    .label = 移动/同步附件
sync-attachment-title =
    .label = 重命名后同步修改附件标题
remove-diacritics =
    .label = 移除文件名中的重音符号

settings-required = 必填

work-mode-title = 工作模式
work-mode-stored-label =
    .label = 仅 Zotero 存储
work-mode-linked-label =
    .label = 外部链接
work-mode-copy-label =
    .label = Zotero 存储 + 外部副本
work-mode-stored-description = 附件保存在 Zotero 中，由 Zotero 文件同步。可按规则重命名。
work-mode-linked-description = 附件移到外部目录，Zotero 以链接方式打开。即以前的“链接”附加类型。
work-mode-stored-footnote = 无需外部目录
work-mode-linked-footnote = 网盘同步 · 仅个人文库
work-mode-copy-description = 附件仍保存在 Zotero 中，并在外部目录自动保留一份按规则整理的副本。
work-mode-copy-footnote = 兼顾 Zotero 同步与外部访问
work-mode-linked-directory = 文件保存目录
work-mode-copy-directory = 副本保存目录
work-mode-directory-placeholder =
    .placeholder = 请选择一个外部目录

work-mode-status-checking = 正在检查目录…
work-mode-status-stored = 可以直接使用，无需外部目录
work-mode-status-ready = 配置完成
work-mode-status-missing = 还需选择外部目录
work-mode-status-invalid = 目录不可用，请重新选择
work-mode-status-unsafe = 请选择 Zotero 存储目录之外的目录
work-mode-status-readonly = 目录不可写，请选择其他目录
work-mode-stored-renaming = 新附件保存在 Zotero 中，文件名使用当前重命名设置。
work-mode-stored-original-name = 新附件保存在 Zotero 中并保留原文件名。
work-mode-linked-ready-note = “移动附件”会把文件放到此目录；开启下方的自动移动后，新附件也会自动移入。
work-mode-copy-ready-note = Zotero 打开自己存储的文件；副本随 Zotero 单向更新。
work-mode-missing-note = 选好目录后即可使用。未配置目录时不会移动附件或生成副本。
work-mode-invalid-note = 目录可能已被删除、移动或尚未挂载。请重新选择可用目录。
work-mode-unsafe-note = 不能使用 Zotero 的 storage 目录，也不能使用（包括经由符号链接）指向其中的路径。
work-mode-readonly-note = Attanger 需要写入此目录。请检查目录权限或同步盘状态。
work-mode-summary-stored = 仅 Zotero 存储 · 已就绪
work-mode-summary-linked = 外部链接 · { $state ->
    [ready] 已就绪
    [checking] 检查中
    [missing] 待选择目录
   *[other] 请检查目录
    }
work-mode-summary-copy = Zotero 存储 + 外部副本 · { $state ->
    [ready] 已就绪
    [checking] 检查中
    [missing] 待选择目录
   *[other] 请检查目录
    }

linked-options-title = 链接选项
work-mode-linked-sync-note = 链接附件不参与 Zotero 文件同步，请用网盘等外部工具同步保存目录。群组文库中的附件不会被转换。
work-mode-copy-sync-title = 副本说明
work-mode-copy-update = 副本按子目录和文件名规则放置；重命名附件或调整分类后，副本随之更新并清理旧副本。副本只从 Zotero 单向更新：在外部修改过的副本不会被覆盖，删除 Zotero 附件时副本保留。PDF 副本不包含 Zotero 数据库中的标注。
work-mode-official-sync-note = Zotero 文件同步（官方存储或 WebDAV）照常在 Zotero 的同步设置中配置。
work-mode-existing = 切换模式不会改动已有附件。需要整理时，右键条目使用“移动附件”或“同步外部副本”。
work-mode-scope = 新导入的附件（包括 Attanger、拖入和 Connector 导入）按当前模式处理；直接添加的链接附件不会被转换。独立 PDF 仅在自动识别成功并生成父条目后处理。

directory-naming-title = 附件命名与目录
organizing-rules-summary = { $mode ->
    [stored] 文件名：{ $rename ->
        [enabled] Zotero 当前规则
       *[disabled] 不自动重命名
        }
   *[external] 子目录：{ $layout ->
        [collection] 按分类
        [year] 按年份
        [flat] 不使用子目录
       *[custom] { $template }
        } · 文件名：{ $rename ->
        [enabled] Zotero 当前规则
       *[disabled] 不自动重命名
        }
    }
filename-rule-title = 文件名规则
filename-zotero-rule-note = 沿用 Zotero 的重命名设置，修改规则使用 Zotero 原生编辑器。
subfolder-layout-collection =
    .label = 按 Zotero 分类
subfolder-layout-year =
    .label = 按年份
subfolder-layout-flat =
    .label = 不使用子目录
subfolder-layout-custom =
    .label = 自定义模板…
subfolder-template-title = 子目录模板
rules-preview-filename = 文件名示例
rules-preview-path = 输出路径示例
rules-preview-unconfigured = 所选目录/{ $path }
rules-preview-unavailable = 无法预览当前规则；请在 Zotero 重命名编辑器中检查模板。
rules-preview-note = 以 Wang、2026、Learning representations 和分类 Machine Learning 为例，不修改实际附件。
rules-preview-skipped = 示例文件 paper-2026.pdf 被当前文件类型或命名例外排除；自动处理时保留原位置和文件名。

source-import-title = 下载文件夹
source-import-optional-note = 用于“附加新文件”和“匹配附件”
source-directory-title = 下载文件夹路径
source-directory-placeholder =
    .placeholder = 未设置，不影响普通导入
add-source-dir =
    .label = 添加文件夹…
remove-source-dir =
    .label = 移除
source-directory-note = “附加新文件”取所有文件夹中最新的文件，“匹配附件”会依次查找。

automatic-processing-title = 自动处理
more-settings-summary = PDF 识别、编辑后重命名、命名例外
auto-recognize-imported-pdf-note = 识别成功并生成父条目后再处理；关闭或失败时保持原样。
rename-timing-title = 调整编辑后的等待时间
automatic-processing-scope-title = 哪些导入会自动处理？
filename-exceptions-title = 文件类型与命名例外
shortcuts-title = 快捷键
shortcuts-summary = 勾选启用，点击输入框后按下组合键

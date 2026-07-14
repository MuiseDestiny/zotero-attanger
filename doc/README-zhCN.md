# Zotero Attanger

<p>
  <img src="../addon/chrome/content/icons/favicon.png" width="48" height="48" alt="Attanger 图标">
</p>

Attanger 是 Attachment Manager 的缩写，用于管理 Zotero 附件：附加最近下载的文件、将文件匹配到条目、按照 Zotero 原生模板重命名，以及按规则移动或复制到固定的目录结构。

[English](../README.md) | 简体中文 | [Deutsch](README-de.md) | [Italiano](README-itIT.md)

[![最新版本](https://img.shields.io/github/v/release/MuiseDestiny/zotero-attanger)](https://github.com/MuiseDestiny/zotero-attanger/releases)
[![发布日期](https://img.shields.io/github/release-date/MuiseDestiny/zotero-attanger)](https://github.com/MuiseDestiny/zotero-attanger/releases)
[![下载量](https://img.shields.io/github/downloads/MuiseDestiny/zotero-attanger/latest/total)](https://github.com/MuiseDestiny/zotero-attanger/releases)
[![许可证：AGPL-3.0-or-later](https://img.shields.io/github/license/MuiseDestiny/zotero-attanger)](../LICENSE)
[![Zotero 7-10](https://img.shields.io/badge/Zotero-7--10-CC2936?logo=zotero&logoColor=white)](https://www.zotero.org/)

## 主要功能

- 将指定源目录中最近修改的文件附加到一个 Zotero 条目，或直接附加到一个分类。
- 将附件保存为 Zotero 存储副本，或把导入的附件转换为外部目录中的链接附件。
- 使用 Zotero 原生文件重命名模板批量重命名，并可同步更新附件标题。
- 根据条目元数据或 `{{collection}}` 创建子目录，并可将变量中的 `/` 解析为多级目录。
- 自动重命名、移动新导入的附件。
- 在条目元数据变化后自动重命名链接附件。防抖和延迟设置适用于 Better BibTeX 引用键等导入后才稳定的字段。
- 按标题相似度将 PDF/CAJ 文件匹配到所选条目，也可读取 PDF 元数据或正文标题辅助匹配。
- 精确重新连接已经符合 Attanger 目录和文件名规则的文件。
- 移动或复制现有附件，并在转换为链接附件时迁移标注、关联关系、全文索引、标签和附件笔记。
- 使用 Zotero、系统默认程序或自定义程序打开附件。
- 自定义快捷键、支持的扩展名、空目录清理和重命名/移动例外正则规则。

## 安装

1. 从 [Releases 页面](https://github.com/MuiseDestiny/zotero-attanger/releases)下载最新 `.xpi`。
2. 在 Zotero 中打开**工具 > 插件**；旧版 Zotero 中该入口可能显示为**工具 > 附加组件**。
3. 打开齿轮菜单，选择**从文件安装插件**，然后选择下载的 `.xpi`。
4. 如果 Zotero 提示，请重新启动。

当前清单支持 Zotero 7 至 Zotero 10。

## 首次配置

打开 **Zotero 设置 > Attanger**：

1. 设置**源路径**：浏览器、扫描软件或其他工具存放新文件的目录。
2. 选择**附加类型**：
   - 使用 Zotero 官方存储或 WebDAV 时选择**存储副本**。
   - 使用 OneDrive、Dropbox、坚果云等第三方同步时选择**链接**。
3. 使用**链接**模式时设置**靶路径**。若希望导入文件自动转换为链接附件，请保持**自动移动添加的附件**开启。
4. 按需设置**子目录**模板。默认值 `{{collection}}` 使用条目所在的分类层级。
5. 点击**设置重命名规则**编辑 Zotero 原生文件名模板。变量语法见 [Zotero 文件重命名文档](https://www.zotero.org/support/file_renaming)。
6. 批量操作前检查自动化、文件类型、快捷键和源文件保留选项。

链接附件不会由 Zotero 文件同步上传，靶目录需要使用其他工具同步或单独备份。

## 常用工作流

### 附加最近下载的文件

1. 将文件保存到已配置的源路径。
2. 在 Zotero 中只选择一个普通条目。
3. 右键选择 **Attanger > 附加新文件**，或按 `Ctrl + I`。

Attanger 会选择源目录中最近修改的非隐藏文件。也可以右键一个分类并选择**附加新文件**，在该分类中创建顶级附件。除非开启**保留原文件**，成功导入后源文件会被删除。

### 为多个条目匹配附件

1. 将 PDF 或 CAJ 文件直接放在源路径根目录。
2. 选择一个或多个普通 Zotero 条目。
3. 选择 **Attanger > 匹配附件**。

每个源文件最多匹配一次。Attanger 会比较条目标题与文件名，并根据**从 PDF 文件读取标题**设置选择是否读取 PDF 元数据或正文。匹配后的文件先导入 Zotero，再按自动重命名和自动移动设置处理。

### 重新连接现有 Attanger 文件库

当文件已经符合以下结构时，使用 **Attanger > 匹配 Attanger 附件**：

```text
源路径 / 渲染后的子目录 / Zotero 生成的文件名.扩展名
```

Attanger 会对每个所选条目检查已配置的扩展名，并直接创建链接附件，不复制文件。

### 重命名、移动或复制现有附件

选择普通条目、子附件或顶级附件后，可以使用：

- **重命名附件**：应用 Zotero 文件名模板。
- **移动附件**：将文件放入靶路径。
- **重命名并移动附件**：连续执行两项操作。
- **撤销移动附件**：调用 Zotero 的“链接附件转存储副本”功能。

开启**保留原文件**后，菜单中的“移动”会变为“复制”，源文件会被保留。移动操作只在**附加类型：链接**时执行。不同文件发生目标路径冲突时会添加后缀；目标位置已有相同文件时不会再次复制。

### 在 Better BibTeX 更新后重命名

文件名模板包含 Better BibTeX 引用键或其他导入后才写入的字段时：

1. 如果新增时重命名发生得太早，关闭**自动重命名添加的附件**。
2. 开启**条目信息变更时自动重命名已链接附件**。
3. 保留默认防抖时间 `1000 ms`；若元数据工具会连续更新多次，可增加延迟时间。

该流程只处理文件存在且类型受支持的链接附件。重复修改事件会去重，Attanger 自身保存条目也不会形成重命名循环。

## 设置说明

| 设置                     | 行为                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------- |
| 源路径                   | “附加新文件”和两种匹配功能使用的输入目录。                                            |
| 附加类型                 | 保存为 Zotero 存储副本，或作为由靶路径管理的链接附件。                                |
| 靶路径                   | 链接模式下移动/复制操作使用的根目录。                                                 |
| 子目录                   | 目录元数据模板；`{{collection}}` 使用分类路径。                                       |
| 将 `/` 解析为子目录      | 保留模板变量产生的斜杠层级。                                                          |
| 自动重命名添加的附件     | Zotero 全局的新增附件自动重命名设置。                                                 |
| 条目信息变更时自动重命名 | 可选的编辑后重命名流程，防抖和延迟单位均为毫秒。                                      |
| 自动移动添加的附件       | 在链接模式下将新导入附件转换为链接附件；已有链接附件不会再次自动移动。                |
| 自动删除空目录           | 只清理 Zotero 存储目录、源路径或靶路径范围内的空目录。                                |
| 保留原文件               | 将移动变为复制，并禁止清理源文件。                                                    |
| 同步附件标题             | 文件重命名后同步修改 Zotero 中的附件标题。                                            |
| 附件类型                 | 不带点号的英文逗号分隔扩展名。默认：`pdf,doc,docx,txt,rtf,djvu,epub`。                |
| 文件名规则               | 用英文逗号分隔的正则表达式，可用于保留原文件名前缀、跳过重命名或跳过自动移动/重命名。 |

无效的正则表达式会被忽略并写入调试日志，不会中断附件处理。

## 快捷键

快捷键可以在 Attanger 设置中编辑，修改后立即生效。

| 操作              | 默认值             | 默认启用 |
| ----------------- | ------------------ | -------- |
| 附加新文件        | `Ctrl + I`         | 是       |
| 匹配附件          | `Ctrl + M`         | 是       |
| 重命名附件        | `Ctrl + R`         | 否       |
| 重命名并移动/复制 | `Ctrl + Shift + R` | 否       |
| 移动/复制附件     | `Ctrl + Shift + M` | 否       |

## 截图与教程

<img width="300" alt="Attanger 设置" src="https://github.com/user-attachments/assets/3125e608-7891-4afa-91f5-be8120a98988">
<img width="300" alt="Attanger 条目菜单" src="https://github.com/user-attachments/assets/9414737c-5d3d-43f3-83be-cf39d8f9c2b7">
<img width="300" alt="Attanger 工作流" src="https://github.com/user-attachments/assets/9c2ff395-66a1-4f1e-8e6a-7c90c3bc4121">

- [中文视频演示](https://www.bilibili.com/video/BV1x64y1J7Rv)
- [法语社区教程](https://docs.zotero-fr.org/kbfr/kbfr_attanger_zotmoov/)

## 欢迎贡献

欢迎提交问题修复、新功能、测试、文档和翻译。范围清晰、改动集中的 PR 更容易审查和安全发布。

报告 Bug 时，请提供 Zotero 与 Attanger 版本、操作系统、附加类型、相关设置、完整复现步骤和调试输出。发布日志前请删除私人文献数据和本地路径。

本地开发：

```bash
git clone https://github.com/MuiseDestiny/zotero-attanger.git
cd zotero-attanger
npm install
cp scripts/zotero-cmd-template.json scripts/zotero-cmd.json
# 编辑 scripts/zotero-cmd.json，使用专门的 Zotero 测试 Profile
npm start
```

提交 PR 前运行：

```bash
npm run build
# 对本次修改的 TypeScript 文件运行 ESLint，例如：
npx eslint src/modules/menu.ts
```

生产 XPI 位于 `build/zotero-attanger.xpi`。开发服务器会热重载 `src/` 和 `addon/` 中的修改。

### 欢迎使用 AI 辅助贡献

可以使用 AI 工具辅助实现、排错、测试、写文档或翻译。使用 AI 本身不会成为拒绝贡献的理由，但提交者仍需对最终结果负责：

- 提交前审查并理解生成的修改。
- 实际测试受影响的工作流，并说明验证过哪些内容。
- 保持改动范围集中，不要混入无关的大规模生成式重写。
- 未经允许，不要把私人文献库、日志、凭据或受版权保护的文档发送给 AI 服务。
- 确认生成代码和资源符合本项目许可证与依赖策略。
- 当 AI 对实现或验证有实质影响时，在 PR 中简要说明，方便审查者理解修改过程。

插件界面翻译位于 `addon/locale/`，用户文档翻译位于 `doc/`。修改时请保持不同语言的键和值含义一致。

## 许可证与致谢

Zotero Attanger 使用 [AGPL-3.0-or-later](../LICENSE) 许可证。附件工作流大量参考了 ZotFile，并基于 [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) 和 [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit) 构建。

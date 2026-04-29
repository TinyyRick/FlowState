# FlowState

一个极简的执行功能辅助工具，旨在降低认知负荷，将时间可视化，并利用 AI 将复杂任务拆解为立即执行的微行动。

<img width="829" height="685" alt="image" src="https://github.com/user-attachments/assets/7b6c0e98-2915-4a65-9288-832623c4c148" />

## 功能

- 桌面便利贴：任务贴 / 想法贴
- 便利贴：拖拽移动、点击前置、等比例缩放
- 专注计时：直接在任务贴内计时（暂停/结束/完成）
- 想法收纳盒：拖拽想法贴进右侧收纳
- 任务收纳盒：拖拽任务贴进右侧收纳，支持完成/删除
- 今日完成日志：查看已完成任务，支持删除（二次确认）
- 状态记录与回顾：日历/历史视图

## 下载与安装

请在 GitHub Releases 页面下载对应系统的安装包：

- macOS：`FlowState-<version>-arm64.dmg` / `FlowState-<version>-x64.dmg`（以及对应 zip 备选）
- Windows：`FlowState Setup <version>.exe`（NSIS 安装包）

未签名版本在 macOS/Windows 上可能会出现系统安全提示，需要手动确认允许打开。

## 本地开发

### 环境要求

- Node.js 22+
- npm 10+

### 启动开发环境

```bash
npm install
npm run electron:dev
```

### 构建

```bash
npm run lint
npm run build
```

### 打包（本机）

```bash
npm run electron:build:mac:arm64
npm run electron:build:mac:x64
npm run electron:build:win:x64
```

产物输出在 `dist_electron/` 目录。

## License

MIT License，见 [LICENSE](LICENSE)。

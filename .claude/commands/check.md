---
description: 跑全套本地校验(前端 lint/test/build + Rust check)。
allowed-tools: Bash
---

按顺序执行下面四条命令,任何一条失败都立即停下,并把失败命令名和最后 30 行输出汇报给我。**不要自己 patch 错误**,只汇报。

1. `pnpm lint`
2. `pnpm test:run`
3. `pnpm build`
4. `cargo check --manifest-path src-tauri/Cargo.toml`

成功的话,简短回报每一步的耗时即可。

# 统计插件（无 GUI）实现说明

本次实现在仓库中新增了 `src/statPlugin/` 模块，按“扫描 → 解析 → 周期过滤 → 累加 → 回写区块”的流程工作。

## 已实现能力（对应你的 v1.0 需求）

- 支持数据语法：`📊 <key> <number> [@YYYY-MM-DD]`
- 支持 key 定向统计
- 支持 period: `all / thisMonth / lastMonth / thisYear / custom`
- 支持 folder 名称过滤
- 支持统计区块自动写回：

```md
<!-- plugin-statistic-any:start
key=overtime
period=thisMonth
folder=work
-->

<!-- plugin-statistic-any:end -->
```

- 监听 note selection change：当选中笔记包含 start 标记时自动刷新
- 增加手动命令：`Refresh statistic blocks`

## 代码结构

- `src/statPlugin/types.ts`：类型定义
- `src/statPlugin/parser.ts`：解析 `📊` 行
- `src/statPlugin/period.ts`：周期范围计算与日期判定
- `src/statPlugin/block.ts`：统计区块解析/替换
- `src/statPlugin/aggregate.ts`：按配置聚合求和
- `src/statPlugin/plugin.ts`：Joplin API 集成（监听、拉取、写回）
- `src/statPlugin/statPlugin.test.ts`：核心逻辑测试

## 和你的规范差异说明

你给的正则只匹配合法数字，因此无法触发“非法 number 记为 0”的规则。当前实现中：
- 先匹配任意 number token
- 再用 `Number(...)` 解析，`NaN` 时落地为 0

这样可满足“非法处理：记录为0”的需求。

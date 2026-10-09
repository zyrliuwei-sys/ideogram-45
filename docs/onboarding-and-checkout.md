# 新用户体验与支付规则

- 仅首次通过 Google 创建账号、且 Google 已验证邮箱的新用户，获得一张标准画质图片所需的积分。当前为 42 积分，可用于生成或编辑。
- 邮箱注册、GitHub 注册、已有邮箱账号绑定 Google、重复 Google 登录均不赠送。
- 赠送记录有唯一键，重试或花完后再次登录不会重新发放。生成失败退款后可以重新体验。
- Google OAuth 和 One Tap 的开关、凭据继续由管理员设置；本次不修改这些配置。
- 旧的“注册赠送积分”通用配置不再控制本产品的新用户赠送。

草稿使用浏览器 IndexedDB 保存提示词、原图、涂抹遮罩、画质、比例和像素锁定选项。登录和支付跳转前等待写入完成，返回后用户自行点击生成。浏览器无法保存时提示用户保留图片和提示词。

积分不足弹窗默认展示一次性积分包。支付返回后只读取当前用户自己的订单，以服务端确认的订单金额和状态记录购买；未确认到账时显示等待提示。PayPal 授权或激活、但尚未实际支付，不会发放付费积分。

Cloudflare D1 的扣费、退款、首次支付发放使用原子批次；重复回调不重复发放，余额不能通过并发提交重复使用。带像素锁定的编辑结果上传到配置的 R2，并替换历史记录中的模型原始结果；保存失败会明确提示先下载当前图片。

验证：

```sh
pnpm test:onboarding
pnpm exec tsc --noEmit
pnpm build
```

测试使用 Wrangler 附带的 Miniflare 创建一次性的真实 D1 数据库，并模拟 PayPal 响应，不调用生产数据库或真实收费接口。覆盖赠送资格、并发扣费和退款、积分优先级、重复支付回调、订单权限、PayPal 支付确认、上传大小限制及历史结果保护。

PayPal Sale 和 Capture 的金额结构不同，兼容依据：[Sale API](https://developer.paypal.com/api/deprecated/payments/v1/sale-get)、[Capture webhook](https://developer.paypal.com/api/rest/webhooks/rest/)。

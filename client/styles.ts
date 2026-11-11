/**
 * 客户端样式：一次性注入一个 `<style>`，全部类名以 `dshgt-` 前缀隔离。
 *
 * 不 import 宿主的 CSS、不依赖 CSS-in-JS 库：客户端产物只允许 `react`，
 * 样式必须自带，否则在别的宿主版本里会掉样式。
 */
export const STYLE_ID = 'dsh-github-trending-style';

export const CSS = `
.dshgt-root{--gt-fg:var(--dsw-alias-label-primary,#1f2328);--gt-muted:var(--dsw-alias-label-secondary,#6b7280);--gt-bg:var(--dsw-alias-bg-base,#fff);--gt-card:var(--dsw-alias-bg-layer-1,#f8fafc);--gt-border:var(--dsw-alias-border-l2,#e5e7eb);--gt-accent:var(--dsw-alias-state-business-primary,#2563eb);--gt-ok:var(--dsw-alias-state-success-primary,#16a34a);--gt-warn:var(--dsw-alias-state-warn-primary,#d97706);--gt-err:var(--dsw-alias-state-error-primary,#dc2626);color:var(--gt-fg);font-size:14px;line-height:1.55;display:flex;flex-direction:column;gap:12px;}
.dshgt-root *{box-sizing:border-box;}
.dshgt-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
.dshgt-title{font-size:15px;font-weight:600;white-space:nowrap;}
.dshgt-sub{color:var(--gt-muted);font-size:12px;}
.dshgt-tabs{display:flex;gap:6px;border-bottom:1px solid var(--gt-border);}
.dshgt-tab{appearance:none;border:none;background:none;padding:6px 10px;font:inherit;color:var(--gt-muted);cursor:pointer;border-bottom:2px solid transparent;}
.dshgt-tab[aria-selected="true"]{color:var(--gt-fg);border-bottom-color:var(--gt-accent);font-weight:600;white-space:nowrap;}
.dshgt-shell{height:100%;min-height:0;overflow:hidden;}
.dshgt-content{flex:1;min-height:0;display:flex;}
.dshgt-scroll{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:12px;}
.dshgt-settings{flex:1;min-height:0;display:grid;grid-template-columns:150px minmax(0,1fr);gap:16px;}
.dshgt-vtabs{display:flex;flex-direction:column;gap:2px;border-right:1px solid var(--gt-border);padding-right:8px;overflow-y:auto;}
.dshgt-vtab{appearance:none;border:none;background:none;text-align:left;padding:7px 10px;border-radius:7px;color:var(--gt-muted);cursor:pointer;font:inherit;font-size:12px;display:flex;align-items:center;gap:6px;}
.dshgt-vtab:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--gt-accent) 8%,transparent));}
.dshgt-vtab[aria-selected="true"]{background:color-mix(in srgb,var(--gt-accent) 12%,transparent);color:var(--gt-fg);font-weight:600;white-space:nowrap;}
.dshgt-vtab-dirty{width:6px;height:6px;border-radius:50%;background:var(--gt-warn);flex:none;margin-left:auto;}
.dshgt-vpanel{min-width:0;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding-right:4px;}
.dshgt-card{border:1px solid var(--gt-border);border-radius:10px;background:var(--gt-card);padding:12px 14px;display:flex;flex-direction:column;gap:8px;}
.dshgt-card-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.dshgt-card-h h3{margin:0;font-size:13px;font-weight:600;white-space:nowrap;}
.dshgt-hint{color:var(--gt-muted);font-size:12px;}
.dshgt-card .dshgt-hint.dshgt-mono{overflow-wrap:anywhere;}
.dshgt-desc{margin:0;color:var(--gt-muted);font-size:12px;}
.dshgt-subhead{margin:4px 0 0;padding-top:8px;border-top:1px solid var(--gt-border);font-size:12px;font-weight:600;color:var(--gt-muted);}
.dshgt-row{display:flex;gap:10px;align-items:center;min-height:28px;flex-wrap:wrap;}
.dshgt-row>label.dshgt-label{width:96px;color:var(--gt-muted);flex:none;font-size:12px;display:flex;align-items:flex-start;gap:5px;}
.dshgt-label-text{flex:1;min-width:0;}
/* 字段说明：圆问号 + 纯 CSS 悬浮气泡（::after 读 data-tip），键盘聚焦同样展开。 */
.dshgt-help{position:relative;flex:none;margin-top:2px;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--gt-border);border-radius:50%;background:var(--gt-bg);color:var(--gt-muted);font-size:10px;line-height:1;font-weight:600;cursor:help;user-select:none;}
.dshgt-help:hover,.dshgt-help:focus-visible{color:var(--gt-fg);border-color:color-mix(in srgb,var(--gt-accent) 55%,var(--gt-border));}
.dshgt-help::after{content:attr(data-tip);position:absolute;left:0;top:calc(100% + 7px);z-index:30;width:max-content;max-width:280px;padding:7px 9px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,var(--gt-card));color:var(--gt-fg);border:1px solid var(--gt-border);font-size:12px;font-weight:400;line-height:1.55;letter-spacing:0;text-align:left;white-space:normal;overflow-wrap:break-word;box-shadow:0 10px 26px rgba(0,0,0,.28);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s ease,visibility .12s;}
.dshgt-help:hover::after,.dshgt-help:focus-visible::after{opacity:1;visibility:visible;}
.dshgt-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.dshgt-input,.dshgt-select,.dshgt-textarea{font:inherit;color:inherit;background:var(--gt-bg);border:1px solid var(--gt-border);border-radius:7px;padding:5px 8px;min-width:0;}
.dshgt-input:focus,.dshgt-select:focus,.dshgt-textarea:focus{outline:2px solid color-mix(in srgb,var(--gt-accent) 35%,transparent);outline-offset:1px;}
.dshgt-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;}
.dshgt-btn{appearance:none;font:inherit;cursor:pointer;border-radius:7px;border:1px solid var(--gt-border);background:var(--gt-bg);padding:5px 10px;color:inherit;}
.dshgt-btn:hover:not(:disabled){border-color:color-mix(in srgb,var(--gt-accent) 45%,var(--gt-border));}
.dshgt-btn:disabled{opacity:.55;cursor:not-allowed;}
.dshgt-btn-primary{background:var(--dsw-alias-button-primary-fill,var(--gt-accent));border-color:var(--dsw-alias-button-primary-fill,var(--gt-accent));color:var(--dsw-alias-label-primary-foreground,#fff);}
.dshgt-default{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--gt-border);border-radius:9px;padding:10px 12px;background:var(--dsw-alias-bg-layer-2,var(--gt-card));}
.dshgt-btn-danger{background:transparent;border-color:var(--gt-err);color:var(--gt-err);}
.dshgt-btn-sm{padding:3px 8px;font-size:12px;}
.dshgt-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--gt-border);border-radius:999px;padding:2px 9px;font-size:12px;background:var(--gt-bg);}
.dshgt-dot{width:7px;height:7px;border-radius:50%;background:var(--gt-muted);flex:none;}
.dshgt-dot.ok{background:var(--gt-ok);} .dshgt-dot.warn{background:var(--gt-warn);} .dshgt-dot.err{background:var(--gt-err);}
.dshgt-alert{border:1px solid var(--gt-border);border-left:3px solid var(--gt-warn);border-radius:8px;padding:8px 10px;background:color-mix(in srgb,var(--gt-warn) 8%,var(--gt-bg));font-size:12px;}
.dshgt-alert.err{border-left-color:var(--gt-err);background:color-mix(in srgb,var(--gt-err) 8%,var(--gt-bg));}
.dshgt-alert.ok{border-left-color:var(--gt-ok);background:color-mix(in srgb,var(--gt-ok) 8%,var(--gt-bg));}
.dshgt-alert b{display:block;margin-bottom:2px;font-size:12px;}
.dshgt-alert-row{display:flex;align-items:flex-start;gap:8px;} .dshgt-alert-row>span{flex:1;min-width:0;}
.dshgt-alert-dismiss{flex:none;appearance:none;border:0;background:none;color:var(--gt-muted);font-size:16px;line-height:1;padding:0 2px;cursor:pointer;border-radius:4px;}
.dshgt-alert-dismiss:hover{color:var(--gt-fg);background:color-mix(in srgb,var(--gt-fg) 8%,transparent);}
.dshgt-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;}
.dshgt-step{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--gt-muted);}
.dshgt-step .st{margin-left:auto;font-size:11px;}
.dshgt-step[data-state="done"]{color:var(--gt-fg);} .dshgt-step[data-state="done"] .st{color:var(--gt-ok);}
.dshgt-step[data-state="active"]{color:var(--gt-fg);} .dshgt-step[data-state="active"] .st{color:var(--gt-accent);}
.dshgt-step[data-state="failed"] .st{color:var(--gt-err);}
.dshgt-kv{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;margin:0;font-size:12px;}
.dshgt-kv dt{color:var(--gt-muted);} .dshgt-kv dd{margin:0;}
.dshgt-table{width:100%;border-collapse:collapse;font-size:12px;}
.dshgt-table th,.dshgt-table td{text-align:left;padding:5px 8px;border-bottom:1px solid var(--gt-border);vertical-align:top;}
.dshgt-table th{color:var(--gt-muted);font-weight:500;}
.dshgt-chips{display:flex;gap:6px;flex-wrap:wrap;}
.dshgt-period-list{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;}
.dshgt-period{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--gt-fg);}
.dshgt-period-check{color:var(--gt-ok);font-size:12px;line-height:1;}
.dshgt-chip{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--gt-border);background:var(--gt-bg);border-radius:999px;padding:2px 10px;font-size:12px;color:var(--gt-muted);}
.dshgt-chip:disabled{cursor:not-allowed;opacity:.4;}
.dshgt-chip[aria-pressed="true"]{background:color-mix(in srgb,var(--gt-accent) 14%,var(--gt-bg));border-color:var(--gt-accent);color:var(--gt-fg);}
.dshgt-switch{appearance:none;cursor:pointer;width:36px;height:20px;border-radius:999px;border:1px solid var(--gt-border);background:var(--gt-muted);position:relative;transition:background .15s;}
.dshgt-switch::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .15s;}
.dshgt-switch[aria-checked="true"]{background:var(--gt-accent);}
.dshgt-switch[aria-checked="true"]::after{transform:translateX(16px);}
.dshgt-footer{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.dshgt-monobox{margin:0;padding:8px;border-radius:7px;background:color-mix(in srgb,var(--gt-fg) 6%,var(--gt-bg));max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word;}
.dshgt-modal-mask{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-1,rgba(15,23,42,.38));display:flex;align-items:center;justify-content:center;z-index:2147483000;}
.dshgt-modal{background:var(--gt-bg);border-radius:12px;border:1px solid var(--gt-border);max-width:640px;width:calc(100% - 32px);max-height:80vh;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 20px 50px rgba(15,23,42,.25);}

/* ——— 自更新后的恢复提示：居中弹层，唯一动作「关闭」，版本跨栏当主角 ——— */
.dshgt-restore-mask{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--dsw-alias-bg-mask-1,rgba(15,23,42,.38));animation:dshgt-restore-mask-in .14s ease-out;}
.dshgt-restore{width:100%;max-width:448px;padding:18px 20px 12px;border-radius:10px;border:1px solid var(--gt-border);background:var(--gt-bg);box-shadow:0 24px 60px rgba(15,23,42,.28),0 2px 8px rgba(15,23,42,.08);animation:dshgt-restore-in .16s cubic-bezier(.2,.8,.3,1);}
.dshgt-restore-versions{display:flex;align-items:center;gap:8px;}
.dshgt-restore-version{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:500;line-height:24px;color:var(--gt-muted);}
.dshgt-restore-version.is-new{font-weight:650;padding:0 8px;border-radius:6px;color:var(--gt-accent);background:color-mix(in srgb,var(--gt-accent) 9%,var(--gt-bg));}
.dshgt-restore-arrow{display:inline-flex;align-items:center;justify-content:center;color:var(--gt-muted);}
.dshgt-restore-title{font-size:15px;font-weight:600;letter-spacing:-.008em;color:var(--gt-fg);}
.dshgt-restore-versions + .dshgt-restore-title{margin-top:12px;}
.dshgt-restore-body{margin:5px 0 0;font-size:13px;line-height:1.6;color:var(--gt-muted);}
.dshgt-restore-foot{display:flex;justify-content:flex-end;margin-top:14px;}
.dshgt-restore-close{appearance:none;font:inherit;font-size:13px;cursor:pointer;padding:5px 10px;border-radius:7px;border:1px solid transparent;background:none;color:var(--gt-accent);}
.dshgt-restore-close:hover{background:color-mix(in srgb,var(--gt-accent) 10%,transparent);}
@keyframes dshgt-restore-in{from{opacity:0;transform:translateY(6px) scale(.985);}to{opacity:1;transform:none;}}
@keyframes dshgt-restore-mask-in{from{opacity:0;}to{opacity:1;}}
@media (prefers-reduced-motion:reduce){.dshgt-restore-mask,.dshgt-restore{animation:none;}}

/* ——— GitHub 设备码登录弹窗 ——— */
.dshgt-authmodal{max-width:420px;gap:14px;}
.dshgt-authmodal-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.dshgt-authmodal-x{border:0;background:transparent;color:var(--gt-muted);font-size:14px;line-height:1;cursor:pointer;padding:4px 6px;border-radius:6px;}
.dshgt-authmodal-x:hover{background:color-mix(in srgb,var(--gt-fg) 8%,transparent);color:var(--gt-fg);}
.dshgt-authmodal-body{display:flex;flex-direction:column;gap:12px;}
.dshgt-authcode{display:flex;align-items:center;justify-content:center;padding:16px 12px;border:1px dashed color-mix(in srgb,var(--gt-accent) 45%,var(--gt-border));border-radius:12px;background:color-mix(in srgb,var(--gt-accent) 6%,var(--gt-bg));}
.dshgt-authcode-value{font-family:var(--gt-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:30px;font-weight:700;letter-spacing:6px;line-height:1.1;color:var(--gt-fg);user-select:all;}
.dshgt-authcode-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.dshgt-authwait{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--gt-muted);}
.dshgt-authwait-dot{width:8px;height:8px;border-radius:50%;background:var(--gt-accent);animation:dshgt-pulse 1.1s ease-in-out infinite;}
@keyframes dshgt-pulse{0%,100%{opacity:.25;transform:scale(.8);}50%{opacity:1;transform:scale(1);}}
.dshgt-authmodal-footer{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px;border-top:1px solid var(--gt-border);padding-top:10px;}
.dshgt-authmodal-footer .dshgt-hint{margin-right:auto;}

/* ——— 01 工作台外壳 ——— */
.dshgt-shell{gap:0;height:100%;min-height:0;overflow:hidden;}
/* 全页统一内容框：五个 tab 的身份条 / tab 条 / 页头 / 正文共用同一条
   「内容宽度 + 左右留白」规则，宽屏居中、窄屏退化为最小 gutter。
   页面内不要再给单个视图加 max-width / margin-inline:auto，否则又会出现
   一半居中一半靠左。 */
.dshgt-app{flex:1;min-height:0;display:flex;flex-direction:column;background:var(--gt-bg);--dshgt-frame:1100px;--dshgt-gutter:30px;--dshgt-inset:max(var(--dshgt-gutter),calc((100% - var(--dshgt-frame)) / 2));}
.dshgt-rail{background:color-mix(in srgb,var(--gt-fg) 3%,var(--gt-bg));border-right:1px solid var(--gt-border);display:flex;flex-direction:column;padding:14px 10px 12px;min-height:0;overflow:hidden;}
.dshgt-brand{display:flex;align-items:center;gap:9px;padding:2px 6px 16px;}
.dshgt-brand svg{flex:none;border-radius:8px;}
.dshgt-brand-name{font-size:13.5px;font-weight:600;line-height:1.3;}
.dshgt-brand-ver{font-size:11px;color:var(--gt-muted);margin-top:1px;min-height:15px;}
.dshgt-nav{display:flex;flex-direction:column;gap:2px;}
.dshgt-nav-item{display:flex;align-items:center;gap:9px;height:36px;padding:0 9px;border:1px solid transparent;border-radius:8px;background:none;text-align:left;font-family:inherit;font-size:13.5px;color:var(--gt-muted);width:100%;cursor:pointer;}
.dshgt-nav-item svg{flex:none;opacity:.82;}
.dshgt-nav-item:hover{background:color-mix(in srgb,var(--gt-fg) 6%,var(--gt-bg));color:var(--gt-fg);}
.dshgt-nav-item.on{background:var(--gt-bg);border-color:var(--gt-border);color:var(--gt-fg);font-weight:600;white-space:nowrap;}
.dshgt-nav-item.on svg{opacity:1;}
.dshgt-nav-tail{margin-left:auto;display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--gt-muted);font-weight:400;}
.dshgt-rail-spacer{flex:1;min-height:16px;}
.dshgt-rail-status{border-top:1px solid var(--gt-border);padding:12px 8px 10px;}
.dshgt-rail-cap{font-size:11.5px;color:var(--gt-muted);margin-bottom:3px;}
.dshgt-rail-time{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;line-height:1.35;}
.dshgt-rail-count{font-size:12px;color:var(--gt-muted);margin-top:1px;min-height:18px;}
.dshgt-rail-ready{display:flex;align-items:center;gap:7px;margin-top:10px;font-size:12px;color:var(--gt-muted);}
.dshgt-rail-pkg{border-top:1px solid var(--gt-border);padding:10px 8px 8px;}
.dshgt-pkg-name{border:0;background:none;padding:0;text-align:left;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;line-height:1.45;color:var(--gt-muted);word-break:break-all;cursor:pointer;max-width:100%;}
.dshgt-pkg-name:hover{color:var(--gt-fg);}
.dshgt-pkg-sub{display:flex;align-items:center;gap:8px;margin-top:3px;font-size:11px;color:var(--gt-muted);}
.dshgt-pkg-sub .dshgt-mono{font-size:10.5px;color:var(--gt-fg);}
.dshgt-pkg-sub a{display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--gt-accent);text-decoration:none;}
.dshgt-pkg-sub a:hover{text-decoration:underline;}
.dshgt-pkg-copy{width:22px;height:22px;margin-left:auto;display:grid;place-items:center;border:0;background:none;border-radius:4px;color:var(--gt-muted);cursor:pointer;}
.dshgt-pkg-copy:hover{background:color-mix(in srgb,var(--gt-fg) 7%,var(--gt-bg));color:var(--gt-fg);}
.dshgt-pkg-copy:disabled{opacity:.4;cursor:not-allowed;}
.dshgt-main{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--gt-bg);}
.dshgt-page-head{display:flex;align-items:flex-start;gap:16px;padding:20px var(--dshgt-inset) 14px;border-bottom:1px solid color-mix(in srgb,var(--gt-border) 70%,transparent);flex:none;}
.dshgt-page-heading{min-width:0;}
.dshgt-page-head h1{margin:0;font-size:21px;line-height:1.25;font-weight:650;letter-spacing:-.012em;}
.dshgt-dek{margin:4px 0 0;font-size:13px;color:var(--gt-muted);max-width:580px;line-height:1.5;}
.dshgt-head-actions{margin-left:auto;display:flex;align-items:center;gap:8px;padding-top:2px;flex:none;}
.dshgt-main-body{flex:1;min-height:0;display:flex;min-width:0;}
.dshgt-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable both-edges;}
/* 设置页不在 .dshgt-scroll 里（自己管理左右分栏滚动），但内容框必须与其它四页完全一致。 */
.dshgt-main-body > .dshgt-settings{flex:1;min-height:0;padding:22px var(--dshgt-inset) 30px;width:100%;}
/* 五个 tab 共用同一个内容框：宽屏居中、窄屏贴最小 gutter；内容本身铺满框内宽度。
   只有空态文案这类「短句」用 text-align / 自身 max-width 控制，不再靠外层居中。 */
.dshgt-view{padding:22px var(--dshgt-inset) 38px;width:100%;display:flex;flex-direction:column;gap:18px;}
.dshgt-grow{flex:1;min-width:0;}
.dshgt-dim{font-size:12px;color:var(--gt-muted);}
.dshgt-empty{padding:48px 0;text-align:center;color:var(--gt-muted);font-size:13px;}
.dshgt-tag{display:inline-flex;align-items:center;height:20px;padding:0 7px;border:1px solid var(--gt-border);border-radius:999px;font-size:11px;color:var(--gt-muted);background:var(--gt-bg);white-space:nowrap;}
.dshgt-inline-tag{margin-left:6px;vertical-align:1px;}
.dshgt-tag-warn{color:var(--gt-warn,#c08a00);border-color:color-mix(in srgb,var(--gt-warn,#c08a00) 45%,var(--gt-border));}

/* ——— 顶部身份条（第一行）：名称 / 版本 / 完整包名 / GitHub / 检查更新 ——— */
.dshgt-idbar{display:flex;align-items:center;gap:9px;height:48px;padding:0 var(--dshgt-inset);border-bottom:1px solid var(--gt-border);flex:none;background:var(--gt-bg);min-width:0;}
.dshgt-idbar .dshgt-brand{display:flex;align-items:center;gap:9px;padding:0;flex:none;min-width:0;}
.dshgt-idbar .dshgt-brand svg{width:22px;height:22px;flex:none;border-radius:6px;}
.dshgt-brand-name{font-size:13.5px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;line-height:1.3;}
.dshgt-id-ver{display:inline-flex;align-items:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--gt-fg);background:var(--gt-card);border:1px solid var(--gt-border);border-radius:999px;padding:1px 7px;line-height:16px;flex:none;white-space:nowrap;}
.dshgt-id-sep{width:1px;height:16px;background:var(--gt-border);flex:none;}
.dshgt-id-pkg{appearance:none;border:0;background:none;padding:2px 4px;border-radius:5px;color:var(--gt-muted);cursor:pointer;font-size:12px;max-width:min(44vw,360px);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto;}
.dshgt-id-pkg:hover{color:var(--gt-fg);background:color-mix(in srgb,var(--gt-fg) 5%,var(--gt-bg));}
/* 更新 / GitHub 入口：紧跟包名，不再靠右推到底，也不加分隔线（A 方案）。 */
.dshgt-idbar-actions{margin-left:2px;position:relative;display:flex;align-items:center;gap:2px;flex:none;min-width:0;}
.dshgt-id-gh{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;color:var(--gt-muted);border:1px solid transparent;flex:none;}
.dshgt-id-gh:hover{color:var(--gt-fg);background:color-mix(in srgb,var(--gt-fg) 6%,var(--gt-bg));border-color:var(--gt-border);}
/* 版本徽标：仅「有新版本」时出现，透明底细描边，高度对齐图标按钮中线 */
.dshgt-ver-badge{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;height:22px;padding:0 8px;border-radius:999px;
  border:1px solid color-mix(in srgb,var(--gt-warn) 42%,transparent);background:transparent;color:var(--gt-warn);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;cursor:pointer;
  margin-left:6px;
  transition:background .12s ease,border-color .12s ease;}
.dshgt-ver-badge:hover{background:color-mix(in srgb,var(--gt-warn) 12%,transparent);border-color:color-mix(in srgb,var(--gt-warn) 60%,transparent);}
.dshgt-ver-badge:focus-visible{outline:2px solid var(--gt-accent);outline-offset:1px;}
/* 纯图标刷新：与 dsh-skills-console 的 .dshsc-tool 逐项一致（尺寸/圆角/无边框/hover 层2底），
   状态另由图标颜色 + 角标 + 旋转表达，文案走 title（tooltip）。独立成类，不再继承 .dshgt-id-gh。 */
.dshgt-refresh{position:relative;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;
  width:26px;height:26px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--gt-muted);
  cursor:pointer;text-decoration:none;transition:background .12s ease,color .12s ease;flex:none;}
.dshgt-refresh:hover{background:var(--dsw-alias-bg-layer-2);color:var(--gt-fg);}
.dshgt-refresh:focus-visible{outline:2px solid var(--gt-accent);outline-offset:1px;}
.dshgt-refresh[aria-expanded="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--gt-fg);}
.dshgt-refresh svg{display:block;transition:color .12s ease;}
.dshgt-refresh[data-state="available"]{color:var(--gt-warn);}
.dshgt-refresh[data-state="available"]::after{content:"";position:absolute;top:3px;right:3px;width:6px;height:6px;border-radius:50%;background:var(--gt-warn);box-shadow:0 0 0 1.5px var(--gt-bg);}
.dshgt-refresh[data-state="checking"]{color:var(--gt-muted);cursor:default;}
.dshgt-refresh[data-state="checking"] svg{animation:dshgt-refresh-spin .9s linear infinite;}
.dshgt-refresh[data-state="error"]{color:var(--gt-err);}
.dshgt-refresh[data-state="ok-flash"]{color:var(--gt-ok);}
@keyframes dshgt-refresh-spin{to{transform:rotate(360deg);}}
/* 确认气泡：贴刷新图标左下方弹出（图标在条左侧，贴右会让气泡朝右伸出屏幕） */
.dshgt-confirm-pop{position:absolute;top:calc(100% + 8px);left:0;z-index:30;box-sizing:border-box;min-width:210px;max-width:280px;
  display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:12px;background:var(--gt-card);border:1px solid var(--gt-border);
  box-shadow:0 12px 32px rgba(0,0,0,.28);}
.dshgt-confirm-title{font-size:12.5px;color:var(--gt-fg);line-height:1.45;}
.dshgt-confirm-actions{display:flex;gap:8px;justify-content:flex-end;}

/* ——— 横向 tab（第二行）+ 右侧状态 ——— */
.dshgt-tabsbar{display:flex;align-items:stretch;gap:12px;height:46px;padding:0 var(--dshgt-inset);border-bottom:1px solid var(--gt-border);flex:none;background:var(--gt-bg);min-width:0;}
.dshgt-tabnav{display:flex;align-items:stretch;gap:2px;height:100%;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;}
.dshgt-tabnav::-webkit-scrollbar{display:none;}
.dshgt-tab{display:flex;align-items:center;gap:7px;padding:0 12px;border:0;background:none;color:var(--gt-muted);cursor:pointer;font:inherit;font-size:13.5px;position:relative;border-bottom:2px solid transparent;margin-bottom:-1px;flex:none;white-space:nowrap;}
.dshgt-tab svg{opacity:.8;}
.dshgt-tab:hover{color:var(--gt-fg);}
.dshgt-tab.on{color:var(--gt-fg);font-weight:600;border-bottom-color:var(--gt-accent);}
.dshgt-tab.on svg{opacity:1;color:var(--gt-accent);}
.dshgt-tab-tail{font-size:10.5px;color:var(--gt-muted);background:var(--gt-card);border:1px solid var(--gt-border);border-radius:999px;padding:0 5px;line-height:15px;}
.dshgt-tabsbar-status{margin-left:auto;display:flex;align-items:center;gap:16px;flex:none;}
.dshgt-status-item{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--gt-muted);white-space:nowrap;}
.dshgt-status-key{color:var(--gt-muted);}
.dshgt-status-val{color:var(--gt-fg);font-weight:600;}
.dshgt-status-sub{color:var(--gt-muted);}
@media (max-width:1100px){ .dshgt-id-pkg{max-width:26vw;} }
@media (max-width:900px){
  .dshgt-id-pkg{max-width:22vw;}
  .dshgt-status-item.dshgt-next{display:none;}
}

/* ——— 概览 ——— */
.dshgt-delivery{border:1px solid var(--gt-border);border-radius:12px;padding:18px 20px 16px;background:var(--gt-card);display:flex;flex-direction:column;gap:6px;}
.dshgt-delivery-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.dshgt-pill-mini{margin-left:auto;font-size:12px;color:var(--gt-muted);border:1px solid var(--gt-border);border-radius:999px;padding:2px 9px;background:var(--gt-bg);}
/* 交付卡标题按状态变化，字号仍是本页主角；日期在上一行的 meta 里只出现一次。 */
.dshgt-delivery h2{margin:4px 0 0;font-size:18px;font-weight:600;letter-spacing:-.01em;line-height:1.35;word-break:break-word;}
.dshgt-when{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--gt-muted);}
.dshgt-when a{color:var(--gt-accent);text-decoration:none;}
.dshgt-when a:hover{text-decoration:underline;}
.dshgt-delivery-error{margin-top:6px;}
.dshgt-artifacts{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;}
.dshgt-filechip{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:0 10px;border:1px solid var(--gt-border);border-radius:8px;background:var(--gt-bg);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--gt-fg);cursor:pointer;text-align:left;max-width:100%;overflow:hidden;}
.dshgt-filechip .dshgt-mono{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dshgt-filechip:hover{border-color:color-mix(in srgb,var(--gt-accent) 40%,var(--gt-border));}
.dshgt-filechip-static{cursor:default;}
.dshgt-filechip-static:hover{border-color:var(--gt-border);}
.dshgt-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border-top:1px solid var(--gt-border);margin-top:12px;padding-top:10px;}
.dshgt-fact{padding:0 14px;border-left:1px solid var(--gt-border);min-width:0;}
.dshgt-fact:first-child{padding-left:0;border-left:0;}
.dshgt-fact-k{font-size:11.5px;color:var(--gt-muted);margin-bottom:2px;}
.dshgt-fact-v{display:flex;align-items:center;gap:6px;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;overflow:hidden;white-space:nowrap;}
/* 截断值保留全文 title，并给一个可键盘触达的复制入口（长 commit / hash 不必手抄）。 */
.dshgt-fact-v > span{overflow:hidden;text-overflow:ellipsis;min-width:0;}
.dshgt-fact-copy{flex:none;appearance:none;border:0;background:none;padding:0 2px;font-family:inherit;font-size:11px;color:var(--gt-muted);cursor:pointer;border-radius:4px;}
.dshgt-fact-copy:hover{color:var(--gt-accent);text-decoration:underline;}
.dshgt-fact-copy.is-copied{color:var(--gt-ok);}
/* 概览首屏第一条：下次运行。常驻，不随窄栏隐藏（外壳里的同一条在 ≤900px 会被收起）。 */
.dshgt-nextrow{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;font-size:12.5px;color:var(--gt-muted);padding:0 2px 2px;}
.dshgt-nextrow-key{font-weight:600;color:var(--gt-fg);}
.dshgt-nextrow-val{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--gt-fg);}
.dshgt-nextrow-rel{color:var(--gt-muted);}
/* 首次使用：给动作，不留一句「还没有运行记录」的死胡同。 */
.dshgt-guide{border:1px solid var(--gt-border);border-radius:12px;padding:18px 20px 16px;background:var(--gt-card);display:flex;flex-direction:column;gap:8px;}
.dshgt-guide h2{margin:0;font-size:16px;font-weight:650;letter-spacing:-.01em;}
.dshgt-guide-desc{margin:0;font-size:13px;line-height:1.7;color:var(--gt-muted);max-width:560px;}
.dshgt-guide-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;}
.dshgt-guide-note{margin:0;font-size:12px;color:var(--gt-warn);}
/* 外壳级：轮询失败时页面可能停在旧快照上，明确说出来并给重连入口。 */
.dshgt-stale{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:7px 14px;border-bottom:1px solid color-mix(in srgb,var(--gt-warn) 35%,var(--gt-border));background:color-mix(in srgb,var(--gt-warn) 10%,var(--gt-bg));font-size:12px;color:var(--gt-fg);}
.dshgt-stale > span{flex:1;min-width:0;}
.dshgt-head-hint{font-size:12px;color:var(--gt-warn);align-self:center;}
.dshgt-day-note{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;color:var(--gt-muted);}
.dshgt-alert-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;}
.dshgt-block{display:flex;flex-direction:column;gap:8px;}
.dshgt-block > .dshgt-btn{align-self:flex-start;}
/* 分组标题用真实 h2（屏幕阅读器可跳读），视觉上仍是小节眉标。 */
.dshgt-section-label{display:flex;align-items:center;gap:9px;margin:0;font-size:12px;font-weight:600;color:var(--gt-muted);letter-spacing:.02em;}
.dshgt-section-label:after{content:"";height:1px;flex:1;background:color-mix(in srgb,var(--gt-border) 70%,transparent);}
/* 小节标题与右侧动作分行放：h2 里不再夹一个按钮，屏幕阅读器读标题时不带动作文案。 */
.dshgt-section-row{display:flex;align-items:center;gap:10px;}
.dshgt-section-row > .dshgt-section-label{flex:1;min-width:0;}
.dshgt-ready-list{border-top:1px solid var(--gt-border);}
.dshgt-ready-row{display:grid;grid-template-columns:16px 108px minmax(0,1fr) auto;align-items:center;gap:12px;min-height:46px;border-bottom:1px solid color-mix(in srgb,var(--gt-border) 70%,transparent);font-size:13.5px;}
.dshgt-ready-label{color:var(--gt-muted);font-size:13px;}
.dshgt-ready-value{color:var(--gt-fg);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dshgt-ready-extra{color:var(--gt-muted);font-size:12px;margin-left:7px;}
.dshgt-linkbtn{border:0;background:none;color:var(--gt-accent);font-family:inherit;font-size:12.5px;padding:6px 2px;border-radius:4px;cursor:pointer;}
.dshgt-linkbtn:hover{text-decoration:underline;}
.dshgt-link{color:var(--gt-accent);text-decoration:none;font-size:12.5px;word-break:break-all;}
.dshgt-link:hover{text-decoration:underline;}
.dshgt-week{display:flex;gap:6px;align-items:stretch;}
.dshgt-day{flex:1;min-width:0;border:1px solid var(--gt-border);border-radius:8px;padding:8px;background:var(--gt-card);display:flex;flex-direction:column;gap:5px;text-align:left;font-family:inherit;color:inherit;}
.dshgt-day-clickable{cursor:pointer;}
.dshgt-day-clickable:hover{border-color:color-mix(in srgb,var(--gt-accent) 40%,var(--gt-border));}
.dshgt-day-date{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--gt-muted);}
.dshgt-day-status{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--gt-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dshgt-lamp{width:7px;height:7px;border-radius:50%;background:var(--gt-muted);flex:none;}
.dshgt-lamp.ok{background:var(--gt-ok);}
.dshgt-lamp.warn{background:var(--gt-warn);}
.dshgt-lamp.err{background:var(--gt-err);}
.dshgt-live{border:1px solid var(--gt-border);border-radius:12px;padding:16px 18px;background:var(--gt-card);display:flex;flex-direction:column;gap:8px;}
.dshgt-live-top{display:flex;align-items:center;gap:9px;font-size:13px;flex-wrap:wrap;}
.dshgt-live-elapsed{margin-left:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:var(--gt-muted);}
.dshgt-live-note{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--gt-muted);line-height:1.6;}
.dshgt-live-actions{display:flex;gap:8px;}
.dshgt-spinner{width:13px;height:13px;border-radius:50%;border:1.6px solid var(--gt-border);border-top-color:var(--gt-accent);animation:dshgt-spin .8s linear infinite;display:inline-block;flex:none;}
@keyframes dshgt-spin{to{transform:rotate(360deg);}}

/* ——— 日报 ——— */
/* 日报不再自己限宽 / 居中：整页与其它四个 tab 共用 .dshgt-view 的内容框，
   工具栏和纸面左右边缘和页头、正文完全对齐。 */
.dshgt-digest{gap:12px;}
.dshgt-digest-subbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.dshgt-datenav{display:flex;align-items:center;gap:2px;border:1px solid var(--gt-border);border-radius:8px;background:var(--gt-card);padding:2px;}
.dshgt-icon-btn{width:28px;height:28px;display:grid;place-items:center;border:1px solid transparent;background:var(--gt-bg);border-radius:6px;color:var(--gt-fg);font-family:inherit;font-size:18px;line-height:1;cursor:pointer;flex:none;}
.dshgt-icon-btn:hover:not(:disabled){background:color-mix(in srgb,var(--gt-fg) 7%,var(--gt-bg));border-color:var(--gt-border);}
.dshgt-icon-btn:disabled{opacity:.3;cursor:not-allowed;}
.dshgt-dateselect{appearance:none;height:28px;border:0;background:transparent;font-family:inherit;font-size:13px;color:var(--gt-fg);padding:0 8px;min-width:210px;max-width:320px;cursor:pointer;}
/* 日报预览纸面：铺满统一内容框；阅读行宽由内边距与字号控制。 */
.dshgt-digest-sheet{width:100%;border:1px solid var(--gt-border);border-radius:12px;background:var(--gt-card);overflow:hidden;}
.dshgt-digest-body{display:flex;flex-direction:column;min-width:0;}
.dshgt-digest-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 12px;border-bottom:1px solid color-mix(in srgb,var(--gt-border) 70%,transparent);background:color-mix(in srgb,var(--gt-fg) 2.5%,var(--gt-card));}
.dshgt-seg{display:inline-flex;border:1px solid var(--gt-border);border-radius:8px;padding:2px;background:var(--gt-bg);gap:2px;}
.dshgt-seg button{border:0;background:none;height:26px;padding:0 11px;border-radius:6px;font-family:inherit;font-size:12.5px;color:var(--gt-muted);cursor:pointer;}
.dshgt-seg button.on{background:var(--gt-card);color:var(--gt-fg);font-weight:600;white-space:nowrap;}
.dshgt-digest-doc{padding:26px 32px 22px;min-width:0;}
.dshgt-doc-meta-table{margin:0 0 18px;}
.dshgt-doc-meta.dshgt-md-table{min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;}
.dshgt-doc-meta .dshgt-doc-meta-key{width:1%;white-space:nowrap;font-weight:600;color:var(--gt-muted);background:color-mix(in srgb,var(--gt-fg) 4%,var(--gt-card));}
.dshgt-doc-meta .dshgt-doc-meta-val{color:var(--gt-fg);word-break:break-word;overflow-wrap:anywhere;}
.dshgt-doc-meta-hash{font-size:11.5px;}
.dshgt-degraded-badge{display:flex;align-items:center;gap:8px;margin:0 0 12px;padding:9px 12px;border:1px solid color-mix(in srgb,var(--gt-warn,#c08a00) 45%,var(--gt-border));border-radius:8px;font-size:12px;line-height:1.5;color:var(--gt-fg);background:color-mix(in srgb,var(--gt-warn,#c08a00) 12%,transparent);}
.dshgt-degraded-icon{font-size:14px;line-height:1;}
.dshgt-digest-raw{margin:0;padding:22px 28px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.75;white-space:pre-wrap;word-break:break-word;color:var(--gt-muted);background:color-mix(in srgb,var(--gt-fg) 2.5%,var(--gt-card));max-height:640px;overflow:auto;}
.dshgt-digest-loading{padding:40px 28px;color:var(--gt-muted);font-size:13px;}
.dshgt-digest-empty{padding:42px 36px 46px;}
.dshgt-status-line{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--gt-muted);}
.dshgt-status-line b{color:var(--gt-fg);font-weight:600;white-space:nowrap;}
.dshgt-digest-empty h2{margin:14px 0 6px;font-size:20px;font-weight:650;letter-spacing:-.012em;}
.dshgt-digest-empty p{margin:0;max-width:580px;font-size:13.5px;line-height:1.7;color:var(--gt-muted);}
.dshgt-digest-error{margin-top:10px;color:var(--gt-err);}
.dshgt-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;}
.dshgt-md{font-size:14px;line-height:1.7;color:var(--gt-fg);word-break:break-word;}
.dshgt-md-h{margin:20px 0 8px;font-weight:650;line-height:1.35;letter-spacing:-.01em;}
.dshgt-md-h1{font-size:24px;margin-top:0;}
.dshgt-md-h2{font-size:18px;}
.dshgt-md-h3{font-size:15.5px;}
.dshgt-md-h4,.dshgt-md-h5,.dshgt-md-h6{font-size:14px;}
.dshgt-md-p{margin:8px 0;color:color-mix(in srgb,var(--gt-fg) 84%,var(--gt-muted));}
.dshgt-md-list{margin:8px 0;padding-left:22px;}
.dshgt-md-list li{margin:3px 0;}
.dshgt-md-quote{margin:12px 0;padding:2px 0 2px 14px;border-left:3px solid var(--gt-border);color:var(--gt-muted);}
.dshgt-md-tablewrap{margin:12px 0;border:1px solid var(--gt-border);border-radius:8px;overflow-x:auto;}
.dshgt-md-table{width:100%;min-width:560px;border-collapse:collapse;font-size:13px;line-height:1.6;}
.dshgt-md-table th,.dshgt-md-table td{padding:7px 10px;text-align:left;vertical-align:top;border-bottom:1px solid color-mix(in srgb,var(--gt-border) 65%,transparent);word-break:normal;overflow-wrap:break-word;}
.dshgt-md-table th{background:color-mix(in srgb,var(--gt-fg) 4%,var(--gt-card));font-weight:600;white-space:nowrap;}
.dshgt-md-table tbody tr:last-child td{border-bottom:0;}
.dshgt-md-table tbody tr:nth-child(even){background:color-mix(in srgb,var(--gt-fg) 2%,var(--gt-card));}
/* 排行榜表：仓库 / Stars / 今日新增 / 摘要。自动布局 + 摘要换行让窄栏不再横向滚动，
   数字列定宽右对齐，仓库列按内容取宽（不截断 owner/repo）。 */
.dshgt-md-table--compact{table-layout:auto;min-width:0;}
/* 表格能拿到的宽度 = 面板/抽屉的实际宽度，与窗口宽度无关，所以窄屏改判必须用容器查询。 */
.dshgt-md-tablewrap--compact{container-type:inline-size;}
.dshgt-md-table--compact th,.dshgt-md-table--compact td{padding:9px 12px;vertical-align:top;border-bottom:1px solid color-mix(in srgb,var(--gt-border) 60%,transparent);}
.dshgt-md-table--compact th{background:transparent;border-bottom:1px solid var(--gt-border);font-size:11.5px;font-weight:600;letter-spacing:.02em;color:var(--gt-muted);}
.dshgt-md-table--compact tbody tr:nth-child(even){background:transparent;}
.dshgt-md-table--compact tbody tr:hover td{background:color-mix(in srgb,var(--gt-fg) 3%,var(--gt-card));}
.dshgt-md-table--compact tbody tr:last-child td{border-bottom:0;}
.dshgt-md-table--compact td:first-child,.dshgt-md-table--compact th:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dshgt-md-table--compact td:first-child{font-weight:600;}
.dshgt-md-table--compact td:first-child .dshgt-md-repo{background:none;padding:0;font-size:12.5px;font-weight:inherit;}
.dshgt-md-num{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums;white-space:nowrap;}
.dshgt-md-table--compact .dshgt-md-num{width:88px;}
.dshgt-md-table--compact td.dshgt-md-num{text-align:right;font-size:12.5px;padding-right:16px;color:color-mix(in srgb,var(--gt-fg) 88%,var(--gt-muted));}
.dshgt-md-clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;line-height:1.65;}
/* 降级来源这类行内标签只是注记，不做成彩色 chip、也不加重字重：每行一个色块会让整张表变吵。 */
.dshgt-md-tag{margin-right:6px;font-size:10px;font-weight:500;letter-spacing:.04em;color:var(--gt-muted);white-space:nowrap;}
.dshgt-md-pre{margin:12px 0;padding:12px 14px;border-radius:8px;background:color-mix(in srgb,var(--gt-fg) 5%,var(--gt-card));overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;}
.dshgt-md-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:color-mix(in srgb,var(--gt-fg) 7%,var(--gt-card));padding:1px 4px;border-radius:4px;}
.dshgt-md-hr{border:0;border-top:1px solid var(--gt-border);margin:18px 0;}
.dshgt-md a{color:var(--gt-accent);text-decoration:none;}
.dshgt-md a:hover{text-decoration:underline;}
/* 表格拿到的宽度不够排四列时（插件侧栏常见宽度），每行堆叠成「仓库 / 数字 / 摘要」三段，
   列头隐藏，数字用 data-label 补回单位，避免两个数字并排却看不出含义。 */
@container (max-width:700px){
  .dshgt-md-tablewrap--compact{border:0;border-radius:0;overflow:visible;}
  .dshgt-md-table--compact{display:block;border-collapse:separate;}
  .dshgt-md-table--compact thead{display:none;}
  .dshgt-md-table--compact tbody{display:block;}
  .dshgt-md-table--compact tbody tr{display:flex;flex-wrap:wrap;gap:2px 10px;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--gt-border) 60%,transparent);}
  .dshgt-md-table--compact tbody tr:last-child{border-bottom:0;}
  .dshgt-md-table--compact td{display:block;width:auto;padding:0;border:0;}
  .dshgt-md-table--compact td:first-child{order:1;flex:1 1 100%;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .dshgt-md-table--compact td.dshgt-md-num{order:2;flex:0 0 auto;width:auto;font-size:12px;text-align:left;padding-right:0;}
  .dshgt-md-table--compact td.dshgt-md-num::before{content:attr(data-label);margin-right:4px;font-size:10px;font-weight:500;letter-spacing:.02em;color:var(--gt-muted);}
  .dshgt-md-table--compact td:last-child{order:3;flex:1 1 100%;}
}

/* ——— 周期标签 / 分段 ——— */
.dshgt-pchip{display:inline-flex;align-items:center;justify-content:center;height:20px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:600;line-height:18px;white-space:nowrap;border:1px solid var(--gt-border);color:var(--gt-muted);background:var(--gt-bg);}
/* 周期 / 订阅同族：同一套尺寸与「填充 + 同色描边 + 同色文字」，只差色相。
   色值从 --tone 派生到宿主 token，深色主题下不会变成刺眼的浅色贴纸。 */
.dshgt-pchip.daily{--tone:#2563eb;}
.dshgt-pchip.weekly{--tone:#7c3aed;}
.dshgt-pchip.monthly{--tone:#0f766e;}
.dshgt-pchip.release{--tone:#b45309;}
.dshgt-pchip.daily,.dshgt-pchip.weekly,.dshgt-pchip.monthly,.dshgt-pchip.release{color:color-mix(in srgb,var(--tone) 82%,var(--gt-fg));border-color:color-mix(in srgb,var(--tone) 30%,var(--gt-bg));background:color-mix(in srgb,var(--tone) 12%,var(--gt-bg));}
.dshgt-period-seg{display:inline-flex;border:1px solid var(--gt-border);border-radius:9px;padding:3px;background:var(--gt-card);gap:3px;}
.dshgt-period-seg button{display:inline-flex;align-items:center;gap:7px;border:0;background:none;height:30px;padding:0 12px;border-radius:7px;font:inherit;font-size:13px;color:var(--gt-muted);cursor:pointer;}
.dshgt-period-seg button:hover{color:var(--gt-fg);}
.dshgt-period-seg button.on{background:var(--gt-bg);color:var(--gt-fg);font-weight:600;box-shadow:0 1px 2px rgba(15,23,42,.08);}
.dshgt-period-count{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--gt-muted);background:color-mix(in srgb,var(--gt-fg) 6%,var(--gt-bg));border-radius:999px;padding:0 6px;line-height:16px;}
.dshgt-period-seg button.on .dshgt-period-count{color:var(--gt-accent);background:color-mix(in srgb,var(--gt-accent) 12%,var(--gt-bg));}
.dshgt-overview-seg{margin-bottom:8px;}
.dshgt-overview-empty{padding:14px 2px;}

/* 概览用量速览：Token / 发版两张卡，每卡两格；无数据时整卡不渲染。 */
.dshgt-usage-glance{gap:8px;}
.dshgt-glance-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;}
.dshgt-glance{border:1px solid var(--gt-border);border-radius:12px;padding:14px 16px 13px;background:var(--gt-card);display:flex;flex-direction:column;gap:10px;min-width:0;}
.dshgt-glance-k{font-size:12px;color:var(--gt-muted);letter-spacing:.02em;}
.dshgt-glance-vs{display:flex;gap:30px;flex-wrap:wrap;}
.dshgt-glance-cell{display:flex;flex-direction:column;gap:2px;min-width:0;}
.dshgt-glance-label{font-size:12px;color:var(--gt-muted);}
.dshgt-glance-val{display:flex;align-items:baseline;gap:5px;min-width:0;}
.dshgt-glance-num{font-size:22px;line-height:1.2;font-weight:650;letter-spacing:-.015em;color:var(--gt-fg);font-variant-numeric:tabular-nums;white-space:nowrap;}
.dshgt-glance-unit{font-size:11.5px;color:var(--gt-muted);}
.dshgt-glance-note{margin:0;}

/* ——— 运行记录 ——— */
.dshgt-runs-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.dshgt-runs-filter{display:flex;align-items:center;gap:4px;margin-left:auto;flex-wrap:wrap;}
/* 两个筛选维度：记录类型 与 周期/状态，用竖线隔开，避免同名胶囊混淆。 */
.dshgt-chipgroup{display:flex;align-items:center;gap:4px;flex-wrap:wrap;}
.dshgt-chipgroup-sep{width:1px;align-self:stretch;min-height:14px;background:var(--gt-border);margin:0 4px;}
.dshgt-run-list{border-top:1px solid var(--gt-border);}
.dshgt-run-item{border-bottom:1px solid color-mix(in srgb,var(--gt-border) 70%,transparent);}
.dshgt-run-row{display:grid;grid-template-columns:18px 120px 56px minmax(0,1fr) 78px 74px 20px;align-items:center;gap:12px;min-height:52px;width:100%;padding:0 6px;border:0;background:none;text-align:left;font-family:inherit;color:var(--gt-fg);cursor:pointer;border-radius:6px;}
.dshgt-run-row:hover{background:color-mix(in srgb,var(--gt-fg) 4%,var(--gt-bg));}
.dshgt-run-date{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--gt-muted);white-space:nowrap;}
.dshgt-run-what{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;}
.dshgt-run-muted{color:var(--gt-muted);font-size:12px;margin-left:6px;}
.dshgt-run-files,.dshgt-run-duration{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--gt-muted);text-align:right;}
.dshgt-run-tokens{font-size:11.5px;color:var(--gt-muted);text-align:right;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis;}
.dshgt-run-item.has-tokens .dshgt-run-row{grid-template-columns:18px 120px 56px minmax(0,1fr) 64px 78px 74px 20px;}
.dshgt-run-chev{color:var(--gt-muted);text-align:center;transition:transform .15s;}
.dshgt-run-item.open .dshgt-run-chev{transform:rotate(90deg);}
.dshgt-run-detail{padding:2px 6px 16px 30px;display:flex;flex-direction:column;gap:10px;}
.dshgt-detail-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 22px;padding:12px 0;border-top:1px solid color-mix(in srgb,var(--gt-border) 70%,transparent);}
.dshgt-detail-k{font-size:11.5px;color:var(--gt-muted);}
.dshgt-detail-v{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all;}
.dshgt-detail-v a{color:var(--gt-accent);text-decoration:none;}
.dshgt-detail-v a:hover{text-decoration:underline;}
.dshgt-run-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.dshgt-releases-detail{padding-top:10px;border-top:1px solid color-mix(in srgb,var(--gt-border) 70%,transparent);}
.dshgt-releases-stats{display:flex;flex-wrap:wrap;gap:6px 20px;}
.dshgt-releases-stat{display:inline-flex;align-items:baseline;gap:6px;}
.dshgt-releases-stat .dshgt-hint{font-size:11.5px;}
.dshgt-runs-foot{padding:4px 2px 0;text-align:right;}

/* ——— 日志抽屉 / 关于 ——— */
.dshgt-log-modal{max-width:820px;width:calc(100% - 32px);}
.dshgt-log-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.dshgt-log-title{margin:0;font-size:15px;}
.dshgt-log-head .dshgt-btn{margin-left:auto;}
.dshgt-log-pre{margin:0;max-height:52vh;overflow:auto;padding:12px;border-radius:8px;background:color-mix(in srgb,var(--gt-fg) 5%,var(--gt-card));font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;}
.dshgt-log-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.dshgt-about{max-width:460px;width:100%;}
.dshgt-about-head{display:flex;align-items:center;gap:10px;}
.dshgt-about-title{margin:0;font-size:15px;font-weight:600;}
.dshgt-about-close{margin-left:auto;flex:none;display:grid;place-items:center;width:28px;height:28px;padding:0;appearance:none;font:inherit;cursor:pointer;border-radius:7px;border:1px solid transparent;background:transparent;color:var(--gt-muted);}
.dshgt-about-close:hover{color:var(--gt-fg);background:color-mix(in srgb,var(--gt-fg) 7%,var(--gt-bg));border-color:var(--gt-border);}
.dshgt-about-close:focus-visible{outline:2px solid color-mix(in srgb,var(--gt-accent) 45%,transparent);outline-offset:1px;}
/* 应用身份：logo / 名称 / 版本胶囊居中；与信息表整卡同色（不再用渐变、无分隔边、无图标阴影） */
.dshgt-about-identity{position:relative;margin:-16px -16px 0;padding:16px;border-radius:12px 12px 0 0;display:flex;flex-direction:column;align-items:center;gap:7px;background:var(--gt-bg);}
.dshgt-about-logo svg{width:32px;height:32px;border-radius:12px;display:block;}
.dshgt-about-name{font-size:13.5px;font-weight:680;letter-spacing:-.01em;line-height:1.2;}
.dshgt-about-ver{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;color:var(--gt-fg);background:var(--gt-card);border:1px solid var(--gt-border);border-radius:999px;padding:0 8px;line-height:16px;}
/* 信息表：无上方分割线，左对齐 label/value */
.dshgt-about .dshgt-kv{grid-template-columns:88px minmax(0,1fr);padding-top:2px;}
.dshgt-about .dshgt-kv a{color:var(--gt-accent);text-decoration:none;}
.dshgt-about .dshgt-kv a:hover{text-decoration:underline;}
.dshgt-about .dshgt-kv dd{min-width:0;overflow-wrap:anywhere;}
/* 包名行：整行可点复制，无独立按钮；复制后行尾浮现「已复制」 */
.dshgt-about-pkgrow{padding:0 !important;}
.dshgt-about-pkglink{appearance:none;font:inherit;border:0;background:none;padding:9px 6px;margin:-9px -6px;border-radius:6px;width:calc(100% + 12px);display:flex;align-items:center;gap:8px;text-align:left;cursor:pointer;color:inherit;}
.dshgt-about-pkglink:hover{background:color-mix(in srgb,var(--gt-fg) 5%,var(--gt-bg));}
.dshgt-about-pkglink-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;user-select:text;}
.dshgt-about-copied{opacity:0;transition:opacity .12s ease;font-size:11px;color:var(--gt-ok);flex:none;}
.dshgt-about-pkglink.is-copied .dshgt-about-copied{opacity:1;}
.dshgt-gh{width:15px;height:15px;display:block;fill:currentColor;}

/* ——— 订阅：命令栏 + 四列表格 + 选择条 + 发版记录抽屉 ——— */
.dshgt-subs{gap:12px;}
/* 工具条：搜索 + 添加 + 选择 + 生成变更分析；列表在上方操作区之下 */
.dshgt-subs-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-bottom:12px;border-bottom:1px solid color-mix(in srgb,var(--gt-border) 70%,transparent);}
.dshgt-subs-search{position:relative;flex:1;min-width:180px;max-width:340px;display:flex;align-items:center;}
.dshgt-subs-search svg{position:absolute;left:9px;color:var(--gt-muted);pointer-events:none;}
.dshgt-subs-search input{width:100%;height:32px;box-sizing:border-box;padding:0 10px 0 30px;border:1px solid var(--gt-border);border-radius:8px;background:var(--gt-bg);color:var(--gt-fg);font:inherit;font-size:13px;}
.dshgt-subs-search input:focus{outline:2px solid color-mix(in srgb,var(--gt-accent) 30%,transparent);outline-offset:1px;border-color:color-mix(in srgb,var(--gt-accent) 45%,var(--gt-border));}
.dshgt-subs-search input::placeholder{color:var(--gt-muted);}
.dshgt-subs-toolbar-spacer{flex:1 1 auto;min-width:0;}
.dshgt-subs-act.gen{color:var(--gt-muted);}
.dshgt-subs-act.gen:hover{color:var(--gt-accent);background:color-mix(in srgb,var(--gt-accent) 10%,transparent);}
.dshgt-subs-act.gen:disabled{opacity:.5;cursor:not-allowed;}
.dshgt-subs-rowbusy{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--gt-accent);padding:3px 4px;white-space:nowrap;}
.dshgt-spin{width:12px;height:12px;border-radius:50%;border:2px solid color-mix(in srgb,var(--gt-accent) 30%,transparent);border-top-color:var(--gt-accent);animation:dshgt-spin .7s linear infinite;display:inline-block;flex:none;}
@keyframes dshgt-spin{to{transform:rotate(360deg);}}
.dshgt-subs-row.is-analyzing{background:color-mix(in srgb,var(--gt-accent) 6%,var(--gt-bg));}
.dshgt-subs-head{display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap;}
.dshgt-subs-head-main{min-width:0;}
.dshgt-subs-head h2{margin:0;font-size:17px;font-weight:650;letter-spacing:-.01em;}
.dshgt-subs-dek{margin:4px 0 0;font-size:12.5px;color:var(--gt-muted);line-height:1.55;max-width:640px;}
.dshgt-subs-head-actions{margin-left:auto;display:flex;gap:8px;flex:none;}
.dshgt-subs-cmdwrap{display:flex;flex-direction:column;gap:8px;}
.dshgt-subs-cmd{display:flex;align-items:center;gap:10px;height:46px;padding:0 12px;border:1px solid var(--gt-border);border-radius:10px;background:var(--gt-bg);box-shadow:0 1px 2px color-mix(in srgb,var(--gt-fg) 5%,transparent);}
.dshgt-subs-cmd:focus-within{border-color:color-mix(in srgb,var(--gt-accent) 55%,var(--gt-border));box-shadow:0 0 0 3px color-mix(in srgb,var(--gt-accent) 12%,transparent);}
.dshgt-subs-cmd input{flex:1;min-width:0;border:0;background:none;outline:0;font:inherit;font-size:15px;color:var(--gt-fg);padding:0;}
.dshgt-subs-cmd input::placeholder{color:var(--gt-muted);}
.dshgt-subs-kbd{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:16px;color:var(--gt-muted);border:1px solid var(--gt-border);border-bottom-width:2px;border-radius:5px;padding:0 5px;background:var(--gt-card);}
.dshgt-subs-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 2px;font-size:12px;color:var(--gt-muted);}
.dshgt-subs-meta-right{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px;color:var(--gt-muted);}
.dshgt-subs-meta-sep{color:color-mix(in srgb,var(--gt-muted) 55%,transparent);}
.dshgt-subs-suggest{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px dashed color-mix(in srgb,var(--gt-accent) 40%,var(--gt-border));border-radius:9px;background:color-mix(in srgb,var(--gt-accent) 5%,var(--gt-bg));font-size:13px;}
.dshgt-subs-suggest .plus{color:var(--gt-accent);font-size:15px;line-height:1;}
.dshgt-subs-suggest .repo{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;}
.dshgt-subs-suggest .hint{margin-left:auto;font-size:11.5px;color:var(--gt-muted);}
.dshgt-subs-table{display:flex;flex-direction:column;min-width:0;}
.dshgt-subs-thead,.dshgt-subs-row{display:grid;grid-template-columns:280px 130px 100px 110px minmax(0,1fr);gap:14px;align-items:center;padding:0 8px;}
.dshgt-subs-thead{height:32px;border-bottom:1px solid var(--gt-border);font-size:11.5px;color:var(--gt-muted);}
.dshgt-subs-th{appearance:none;border:0;background:none;font:inherit;color:inherit;cursor:pointer;padding:0;display:inline-flex;align-items:center;gap:4px;justify-self:start;text-align:left;}
.dshgt-subs-th.right{justify-self:end;}
.dshgt-subs-th:hover{color:var(--gt-fg);}
.dshgt-subs-th[aria-sort="ascending"],.dshgt-subs-th[aria-sort="descending"]{color:var(--gt-fg);}
.dshgt-subs-ord{font-size:9px;line-height:1;color:var(--gt-accent);}
.dshgt-subs-row{min-height:44px;border-bottom:1px solid color-mix(in srgb,var(--gt-border) 70%,transparent);cursor:pointer;}
.dshgt-subs-row:hover{background:color-mix(in srgb,var(--gt-fg) 3%,var(--gt-bg));}
.dshgt-subs-row.is-focus{background:color-mix(in srgb,var(--gt-accent) 7%,var(--gt-bg));box-shadow:inset 2px 0 0 var(--gt-accent);}
.dshgt-subs-ident{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dshgt-subs-ident mark{background:color-mix(in srgb,var(--gt-accent) 18%,transparent);color:inherit;border-radius:3px;padding:0 1px;}
.dshgt-subs-ident-link{color:inherit;text-decoration:none;min-width:0;overflow:hidden;text-overflow:ellipsis;}
.dshgt-subs-ident-link:hover{color:var(--gt-accent);text-decoration:underline;text-underline-offset:2px;}
.dshgt-subs-ver{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--gt-fg);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}
.dshgt-subs-sum{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--gt-muted);text-align:right;white-space:nowrap;}
.dshgt-subs-stat{display:flex;align-items:center;gap:6px;padding-left:4px;font-size:12px;color:var(--gt-muted);white-space:nowrap;}
.dshgt-subs-thead .dshgt-subs-stat{font-size:11.5px;}
.dshgt-subs-stat.warn{color:var(--gt-warn);}
.dshgt-subs-stat.err{color:var(--gt-err);}
.dshgt-subs-actions{display:flex;align-items:center;justify-content:flex-end;gap:2px;justify-self:end;min-width:116px;}
.dshgt-subs-act{appearance:none;border:0;background:none;font:inherit;font-size:12px;color:var(--gt-muted);cursor:pointer;padding:3px 6px;border-radius:5px;white-space:nowrap;}
.dshgt-subs-act:hover{color:var(--gt-accent);background:color-mix(in srgb,var(--gt-accent) 10%,transparent);}
.dshgt-subs-act.rm{opacity:0;transition:opacity .12s;padding:3px 4px;}
.dshgt-subs-row:hover .dshgt-subs-act.rm,.dshgt-subs-row:focus-within .dshgt-subs-act.rm,.dshgt-subs-act.rm:focus-visible{opacity:1;}
.dshgt-subs-act.rm:hover{color:var(--gt-err);background:color-mix(in srgb,var(--gt-err) 8%,transparent);}
.dshgt-subs-empty{padding:52px 16px 40px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;color:var(--gt-muted);font-size:12.5px;}
.dshgt-subs-empty b{font-size:14px;font-weight:600;color:var(--gt-fg);}
.dshgt-subs-empty .dshgt-btn{margin-top:10px;}
.dshgt-subs-keys{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:2px;font-size:11.5px;color:var(--gt-muted);}
.dshgt-subs-drawer-mask{position:fixed;inset:0;z-index:2147483000;display:flex;justify-content:flex-end;background:rgba(4,6,9,.55);}
.dshgt-subs-drawer{width:460px;max-width:100%;height:100%;display:flex;flex-direction:column;background:var(--gt-card);border-left:1px solid var(--gt-border);box-shadow:-30px 0 70px rgba(0,0,0,.38);}
.dshgt-subs-drawer-head{flex:none;display:flex;align-items:flex-start;gap:10px;padding:16px 20px 12px;border-bottom:1px solid var(--gt-border);}
.dshgt-subs-drawer-main{flex:1;min-width:0;}
.dshgt-subs-drawer-repo{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;font-weight:600;word-break:break-all;}
.dshgt-subs-drawer-sub{margin-top:4px;font-size:11.5px;color:var(--gt-muted);}
.dshgt-subs-drawer-close{flex:none;width:28px;height:28px;display:grid;place-items:center;appearance:none;border:0;border-radius:6px;background:none;color:var(--gt-muted);font-size:18px;line-height:1;cursor:pointer;}
.dshgt-subs-drawer-close:hover{background:var(--dsw-alias-bg-layer-2,var(--gt-card));color:var(--gt-fg);}
.dshgt-subs-drawer-regen{flex:none;align-self:flex-start;appearance:none;border:1px solid var(--gt-border);border-radius:6px;background:none;color:var(--gt-muted);font:inherit;font-size:12px;line-height:1;padding:5px 9px;cursor:pointer;white-space:nowrap;}
.dshgt-subs-drawer-regen:hover:not(:disabled){color:var(--gt-accent);border-color:color-mix(in srgb,var(--gt-accent) 45%,var(--gt-border));background:color-mix(in srgb,var(--gt-accent) 8%,transparent);}
.dshgt-subs-drawer-regen:disabled{opacity:.5;cursor:not-allowed;}
.dshgt-subs-regen-hint{margin:0;font-size:11.5px;color:var(--gt-muted);line-height:1.5;}
.dshgt-subs-drawer-body{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:12px 20px 18px;}
.dshgt-subs-vol{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--gt-muted);}
.dshgt-subs-vol .label{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}
.dshgt-subs-drawer-note{margin-top:auto;padding-top:12px;border-top:1px solid var(--gt-border);font-size:11.5px;color:var(--gt-muted);line-height:1.65;word-break:break-word;}
.dshgt-subs-drawer-raw{margin:0;padding:12px 14px;border-radius:8px;background:color-mix(in srgb,var(--gt-fg) 5%,var(--gt-card));font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.65;white-space:pre-wrap;overflow-wrap:break-word;}
/* 抽屉正文纸面：md 铺在卡面上（与日报预览 .dshgt-digest-sheet 同一观感），不再直接贴页面底色。 */
.dshgt-subs-drawer-doc{border:1px solid var(--gt-border);border-radius:10px;background:var(--dsw-alias-bg-layer-2,var(--gt-card));padding:14px 16px;}
.dshgt-subs-drawer-doc .dshgt-subs-drawer-raw{background:transparent;padding:0;}
/* 抽屉专用紧凑 md 排版：覆盖日报的大号 .dshgt-md（h1 24 / h2 18），保留结构其余样式。 */
.dshgt-subs-drawer-doc .dshgt-md{font-size:12.5px;line-height:1.7;}
.dshgt-subs-drawer-doc .dshgt-md-h1{font-size:15px;margin:0 0 4px;}
.dshgt-subs-drawer-doc .dshgt-md-h2{font-size:13px;margin:14px 0 6px;padding-left:8px;border-left:3px solid var(--gt-accent);}
.dshgt-subs-drawer-doc .dshgt-md-h3{font-size:12.5px;}
.dshgt-subs-drawer-doc .dshgt-md-h4,.dshgt-subs-drawer-doc .dshgt-md-h5,.dshgt-subs-drawer-doc .dshgt-md-h6{font-size:12px;}
.dshgt-subs-drawer-doc .dshgt-md-p{font-size:12.5px;margin:6px 0;}
.dshgt-subs-drawer-doc .dshgt-md-list{font-size:12.5px;padding-left:18px;}
.dshgt-subs-drawer-doc .dshgt-md-list li{margin:3px 0;}
.dshgt-subs-drawer-doc .dshgt-md-quote{font-size:12.5px;}
.dshgt-subs-drawer-doc .dshgt-md-table{min-width:0;font-size:12px;}
.dshgt-subs-drawer-doc .dshgt-md-pre{font-size:11.5px;padding:10px 12px;}
.dshgt-subs-drawer-doc .dshgt-md-code{font-size:11.5px;}
/* 标题锚点跳转时留出顶距，避免贴边。 */
.dshgt-subs-drawer-doc .dshgt-md-h{scroll-margin-top:8px;}
/* 正文里版本号 / owner/repo 的等宽醒目样式（纯表现，不改文本）。 */
.dshgt-md .dshgt-md-ver{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.94em;font-weight:600;color:var(--gt-fg);background:color-mix(in srgb,var(--gt-accent) 12%,transparent);padding:0 4px;border-radius:4px;}
.dshgt-md .dshgt-md-repo{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.94em;color:var(--gt-fg);background:color-mix(in srgb,var(--gt-fg) 6%,transparent);padding:0 3px;border-radius:4px;}
/* 抽屉内的本册目录（TOC）：源无标题时不出现。 */
.dshgt-subs-toc{margin:0 0 12px;padding:8px 10px;border:1px solid var(--gt-border);border-radius:8px;background:color-mix(in srgb,var(--gt-fg) 3%,transparent);}
.dshgt-subs-toc-title{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--gt-muted);margin-bottom:4px;}
.dshgt-subs-toc ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px;}
.dshgt-subs-toc li.lvl-2{padding-left:12px;}
.dshgt-subs-toc li.lvl-3{padding-left:24px;}
.dshgt-subs-toc-link{appearance:none;border:0;background:none;font:inherit;font-size:12px;line-height:1.6;color:var(--gt-muted);text-align:left;padding:1px 4px;border-radius:4px;cursor:pointer;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dshgt-subs-toc-link:hover{color:var(--gt-accent);background:color-mix(in srgb,var(--gt-accent) 8%,transparent);}
/* 添加订阅居中小弹窗 */
.dshgt-addmodal{max-width:420px;}
.dshgt-addmodal-input{height:34px;width:100%;}
.dshgt-addmodal-err{color:var(--gt-err);}
/* 键盘焦点：可交互元素统一给可见焦点环；此前只有少数自定义控件有，Tab 走查会跟丢。 */
.dshgt-btn:focus-visible,.dshgt-chip:focus-visible,.dshgt-tab:focus-visible,.dshgt-vtab:focus-visible,.dshgt-day:focus-visible,.dshgt-linkbtn:focus-visible,.dshgt-icon-btn:focus-visible,.dshgt-fact-copy:focus-visible,.dshgt-alert-dismiss:focus-visible,.dshgt-period-seg button:focus-visible,.dshgt-seg button:focus-visible,.dshgt-subs-th:focus-visible,.dshgt-subs-act:focus-visible,.dshgt-about-pkglink:focus-visible{outline:2px solid var(--gt-accent);outline-offset:2px;}
@media (max-width:1040px){
  .dshgt-subs-thead,.dshgt-subs-row{grid-template-columns:240px 120px 110px minmax(0,1fr);}
  .dshgt-subs-sum,.dshgt-subs-th-summary{display:none;}
}
@media (max-width:720px){
  .dshgt-subs-thead{display:none;}
  .dshgt-subs-thead,.dshgt-subs-row{gap:4px 10px;padding:6px 8px;}
  .dshgt-subs-row{grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:"ident ident stat" "ver sum actions";min-height:0;}
  .dshgt-subs-ident{grid-area:ident;}
  .dshgt-subs-ver{grid-area:ver;text-align:left;}
  .dshgt-subs-sum{display:block;grid-area:sum;text-align:left;}
  .dshgt-subs-stat{grid-area:stat;justify-self:end;}
  .dshgt-subs-actions{grid-area:actions;justify-self:end;min-width:0;}
  /* 触屏没有 hover：窄屏把「移除」常显，否则点不到。 */
  .dshgt-subs-act.rm{opacity:1;}
  .dshgt-subs-meta-right{margin-left:0;}
  .dshgt-subs-drawer{width:100%;border-left:0;}
}

@media (max-width:1100px){
  .dshgt-app{--dshgt-gutter:22px;}
  .dshgt-page-head{padding-block:18px 12px;}
  .dshgt-view{padding-block:18px 30px;}
  .dshgt-main-body > .dshgt-settings{padding-block:18px 22px;}
  .dshgt-facts{grid-template-columns:repeat(2,minmax(0,1fr));row-gap:10px;}
  .dshgt-fact:nth-child(3){padding-left:0;border-left:0;}
  .dshgt-week{flex-wrap:wrap;}
  .dshgt-day{flex:1 1 88px;}
  .dshgt-run-row{grid-template-columns:18px 104px 52px minmax(0,1fr) 70px 20px;}
  .dshgt-run-item.has-tokens .dshgt-run-row{grid-template-columns:18px 104px 52px minmax(0,1fr) 58px 70px 20px;}
  .dshgt-run-files{display:none;}
  .dshgt-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
  .dshgt-dateselect{min-width:180px;}
}
@media (max-width:980px){
  .dshgt-page-head h1{font-size:19px;}
  .dshgt-dek{font-size:12.5px;}
  .dshgt-main-body > .dshgt-settings{padding-block:16px 18px;}
}
@media (max-width:760px){
  .dshgt-app{--dshgt-gutter:18px;}
  .dshgt-idbar{gap:8px;}
  .dshgt-id-pkg{max-width:26vw;}
  .dshgt-id-status{display:none;}
  .dshgt-tabsbar{gap:8px;}
  .dshgt-tabsbar-status{display:none;}
  .dshgt-page-head{flex-wrap:wrap;padding-block:16px 12px;gap:10px 16px;}
  .dshgt-head-actions{margin-left:0;width:100%;justify-content:flex-start;padding-top:0;flex-wrap:wrap;}
  .dshgt-view{padding-block:16px 28px;}
  .dshgt-main-body > .dshgt-settings{padding-block:14px 18px;}
  .dshgt-runs-filter{margin-left:0;width:100%;flex-wrap:wrap;}
  .dshgt-run-row{grid-template-columns:14px 92px 46px minmax(0,1fr) 20px;gap:8px;padding:0 2px;}
  .dshgt-run-item.has-tokens .dshgt-run-row{grid-template-columns:14px 92px 46px minmax(0,1fr) 64px 20px;}
  .dshgt-run-duration{display:none;}
  .dshgt-settings{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);gap:10px;}
  .dshgt-vtabs{flex-direction:row;flex-wrap:wrap;overflow:visible;border-right:0;border-bottom:1px solid var(--gt-border);padding:0 0 8px;}
  .dshgt-vtabs::-webkit-scrollbar{display:none;}
  .dshgt-vtab{flex:none;white-space:nowrap;}
  .dshgt-vpanel{padding-right:0;}
  .dshgt-facts{grid-template-columns:minmax(0,1fr);row-gap:8px;}
  .dshgt-fact{padding:0;}
  .dshgt-fact + .dshgt-fact{border-left:0;padding-top:8px;border-top:1px solid color-mix(in srgb,var(--gt-border) 70%,transparent);}
  .dshgt-detail-grid{grid-template-columns:minmax(0,1fr);}
}
@media (max-width:560px){
  .dshgt-modal{width:calc(100% - 20px);padding:14px;max-height:88vh;}
  .dshgt-about{max-width:none;}
  .dshgt-about-identity{margin:-14px -14px 0;padding:14px;}
  .dshgt-about .dshgt-kv{grid-template-columns:88px minmax(0,1fr);}
  .dshgt-authmodal-footer .dshgt-hint{flex-basis:100%;}
}
@media (max-width:480px){
  .dshgt-brand-name{display:none;}
  .dshgt-id-pkg{max-width:30vw;}
  .dshgt-tab{padding:0 9px;gap:5px;font-size:13px;}
  .dshgt-tab-tail{display:none;}
}
@media (max-width:380px){
  .dshgt-tab svg{display:none;}
  .dshgt-tab{padding:0 10px;}
}
@media (max-width:420px){
  .dshgt-about .dshgt-kv{grid-template-columns:minmax(0,1fr);gap:2px 0;}
  .dshgt-about .dshgt-kv dt{margin-top:6px;}
  .dshgt-authcode-value{font-size:24px;letter-spacing:4px;}
}
`;

export function injectStyles(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const existing = document.getElementById(STYLE_ID);
  if (existing !== null) return () => undefined;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
  return () => {
    style.remove();
  };
}

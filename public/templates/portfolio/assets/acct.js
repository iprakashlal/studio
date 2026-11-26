/* Customer accounts for a shop or a restaurant (content.account). A customer signs in with a code sent to their mobile
   number or their email address (new or returning: it is the same step), stays signed in on this device, and opens
   "My account": a drawer with the order in progress and its tracking, the order history with a bill for every order,
   and their profile (name, the other contact, saved addresses). The site's own database sends the codes and keeps it all.
   window.SiteAcct = { init, on, user, profile, favs, setFavs, gate, open, out, skipped } */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const digits = (s) => String(s || "").replace(/\D/g, "");
  const VIA = { wa: "on WhatsApp", sms: "by SMS" };
  /* An order's progress, as the customer reads it. */
  const LIVE = { new: 0, read: 0, replied: 1, accepted: 1, preparing: 2, ready: 3, out: 4, done: 5, archived: 5 };
  const STEPS = { restaurant: ["Received", "Accepted", "Being prepared", "Ready", "On the way", "Completed"], store: ["Received", "Confirmed", "Packed", "Ready to ship", "Shipped", "Delivered"] };
  let cfg = null, can = null, me = null, demoMe = null, skip = null, where = null, modal = null, data = null, timer = 0;
  const ui = { tab: "", val: "", sent: false, via: "", msg: "", busy: false, open: "", view: "", saved: "", addrs: null };
  const key = () => "acct:" + cfg.site;
  const real = (path, body) => fetch(cfg.api + "/" + path + "/" + encodeURIComponent(cfg.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  /* In the Studio's preview there is no database: a made-up customer and two made-up orders stand in, so the look can be chosen. */
  let demoProfile = null;
  function demo(path, body) {
    const ok = (j) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(j) }), it = (cfg.demoItems || []).slice(0, 3), day = 86400000;
    if (/^e?otp\/send/.test(path)) return ok({ ok: true, via: body.via });
    if (/^e?otp\/check/.test(path)) return ok({ ok: true, token: "demo" });
    if (path === "acct/in") return ok({ ok: true, kind: body.phone ? "phone" : "email", key: body.phone ? "91" + digits(body.phone).slice(-10) : String(body.email).toLowerCase(), pass: Date.now() + day + ".demo" });
    if (path === "acct/save") { demoProfile = { name: body.name, phone: body.phone || "", email: body.email || "", addresses: body.addresses || [], dob: body.dob || "", gender: body.gender || "" }; return ok({ ok: true, profile: demoProfile }); }
    const P = demoProfile || { name: "Asha Rao", phone: "+91 98765 43210", email: "asha@example.com", addresses: [{ label: "Home", line1: "12 MG Road", line2: "Camp", city: "Pune", pin: "411001", state: "Maharashtra" }] }, m = cfg.money || ((n) => String(n));
    return ok({ ok: true, ...P, count: 2, points: 120, loyalty: { worth: 1, min: 50, maxPct: 50 }, orders: [
      { no: "SAMPLE-1002", at: new Date(Date.now() - 20 * 60000).toISOString(), total: m(640), status: "preparing", mode: cfg.kind === "store" ? "Shop order" : "Delivery", paid: true, pay: "Paid online", address: "12 MG Road, Pune", name: P.name, points: "Earned 32 points", items: it.map((x, i) => ({ n: x.n, q: i ? 1 : 2, i: x.i })), text: "" },
      { no: "SAMPLE-1001", at: new Date(Date.now() - 6 * day).toISOString(), total: m(420), status: "done", mode: cfg.kind === "store" ? "Shop order" : "Pick-up", paid: false, pay: "", address: "", name: P.name, points: "Earned 21 points", items: it.slice(0, 1).map((x) => ({ n: x.n, q: 1, i: x.i })), text: "" }] });
  }
  const post = (path, body) => (cfg.demo ? demo(path, body) : real(path, body));
  const steps = () => STEPS[cfg.kind === "store" ? "store" : "restaurant"];
  const label = (o) => (o.status === "cancelled" ? "Cancelled" : steps()[LIVE[o.status] || 0]);
  const active = (o) => o.status !== "cancelled" && (LIVE[o.status] || 0) < 5;

  /* The look follows the site's theme (its accent colour, corners, fonts, dark mode) and the owner's choices under
     Theme & layout → Account customization (content.account.ui), set as data-… on the panel and the sign-in card. */
  const CSS = `
.sa-ui{--sa-acc:var(--c1,var(--accent,#1f4d3a));--sa-on:var(--on-c1,var(--on-accent,#fff));--sa-r:var(--r,14px);--sa-bb:var(--sa-acc);--sa-bf:var(--sa-on);--sa-tint:color-mix(in srgb,var(--sa-acc) 12%,transparent)}
.sa-ui[data-tone=ink]{--sa-acc:var(--text,#1b1a17);--sa-on:var(--bg,#fff);--sa-bb:var(--sa-acc);--sa-bf:var(--sa-on)}
.sa-ui[data-tone=soft]{--sa-bb:var(--sa-tint);--sa-bf:var(--sa-acc)}
.sa-ui[data-corners=soft]{--sa-r:16px}.sa-ui[data-corners=round]{--sa-r:26px}.sa-ui[data-corners=sharp]{--sa-r:2px}
.sa{font-family:var(--fb,inherit);color:var(--text,#1b1a17);display:grid;gap:16px;text-align:left;font-size:15px;line-height:1.5}
.sa h3,.sa-title{margin:0;font-family:var(--fd,inherit);font-weight:700;font-size:23px;line-height:1.18;letter-spacing:-.015em}.sa p{margin:0}.sa .sa-soft{color:var(--soft,#6b665d);font-size:13.5px;line-height:1.5}
.sa-badge{width:52px;height:52px;border-radius:calc(var(--sa-r) + 4px);display:grid;place-items:center;background:var(--sa-tint);color:var(--sa-acc)}.sa-badge svg{width:26px;height:26px}
.sa-seg{display:inline-flex;justify-self:start;border:1px solid var(--line,#ddd);border-radius:999px;padding:3px;gap:2px;max-width:100%}
.sa-seg button{border:0;background:transparent;color:inherit;opacity:.72;font:inherit;font-size:13.5px;font-weight:600;padding:7px 15px;border-radius:999px;cursor:pointer;white-space:nowrap;transition:background .18s,color .18s,opacity .18s}
.sa-seg button[aria-pressed=true]{background:var(--sa-acc);color:var(--sa-on);opacity:1}.sa-seg.sm button{font-size:13px;padding:6px 13px}
.sa-f{display:grid;gap:6px;min-width:0}.sa-f label{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--soft,#6b665d)}
.sa-f input,.sa-in input{width:100%;box-sizing:border-box;border:1.5px solid var(--line,#ddd);background:var(--surface,#fff);color:inherit;border-radius:calc(var(--sa-r)*.7 + 2px);padding:13px 15px;font:inherit;font-size:16px;min-height:52px;transition:border-color .15s,box-shadow .15s}
.sa-f input:focus,.sa-in input:focus{outline:0;border-color:var(--sa-acc);box-shadow:0 0 0 4px var(--sa-tint)}.sa-f input[readonly]{opacity:.65}
.sa-in{position:relative}.sa-in input{padding-right:128px}
.sa-in button{position:absolute;right:7px;top:50%;transform:translateY(-50%);height:38px;padding:0 17px;border:0;border-radius:calc(var(--sa-r)*.55 + 2px);background:var(--sa-bb);color:var(--sa-bf);font:inherit;font-weight:700;font-size:14px;cursor:pointer;white-space:nowrap;transition:filter .15s,transform .15s}
.sa-in button:hover,.sa-btn.pri:hover{filter:brightness(1.08)}.sa-in button[disabled],.sa-btn[disabled]{opacity:.5;cursor:default}
.sa-link{justify-self:start;border:0;background:none;padding:0;color:inherit;font:inherit;font-size:13.5px;font-weight:600;text-decoration:underline;text-underline-offset:3px;cursor:pointer;opacity:.8}
.sa-bad{color:#b3261e;font-size:13.5px;font-weight:600}html[data-dark=true] .sa-bad{color:#ff9e94}.sa-good{color:#1e7a46;font-size:13.5px;font-weight:600}html[data-dark=true] .sa-good{color:#7bd9a0}
.sa-safe{display:flex;gap:8px;align-items:center}.sa-safe svg{width:15px;height:15px;flex:none;opacity:.7}
.sa-sk{display:block;height:46px;border-radius:12px;background:linear-gradient(100deg,rgba(128,128,128,.12) 30%,rgba(128,128,128,.24) 50%,rgba(128,128,128,.12) 70%);background-size:300% 100%;animation:sa-sh 1.3s linear infinite}.sa-sk.t{height:26px;width:60%}.sa-sk.h{height:96px}@keyframes sa-sh{from{background-position:100% 0}to{background-position:0 0}}
.sa-card{border:1px solid var(--line,#ddd);background:var(--surface,#fff);border-radius:calc(var(--sa-r) + 6px);padding:26px;max-width:460px;box-shadow:0 18px 50px -28px rgba(0,0,0,.35)}
.sa-back{position:fixed;inset:0;z-index:2147483000;background:rgba(10,10,10,.5);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;justify-content:flex-end;animation:sa-fade .2s ease-out}
.sa-back[data-panel=left]{justify-content:flex-start}.sa-back[data-panel=sheet]{justify-content:center;align-items:center;padding:16px}
.sa-drawer{width:min(480px,100vw);height:100%;background:var(--bg,#fff);color:var(--text,#1b1a17);font-family:var(--fb,inherit);box-shadow:0 0 70px -10px rgba(0,0,0,.45);display:flex;flex-direction:column;overflow:hidden;animation:sa-in .28s cubic-bezier(.2,.8,.2,1)}
.sa-back[data-panel=left] .sa-drawer{animation-name:sa-inl}.sa-back[data-panel=full] .sa-drawer{width:100vw}
.sa-back[data-panel=sheet] .sa-drawer{height:auto;max-height:min(92vh,880px);width:min(560px,100%);border-radius:calc(var(--sa-r) + 10px);animation-name:sa-up}
@keyframes sa-in{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}@keyframes sa-inl{from{transform:translateX(-40px);opacity:0}to{transform:none;opacity:1}}@keyframes sa-up{from{transform:translateY(24px) scale(.98);opacity:0}to{transform:none;opacity:1}}@keyframes sa-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.sa-drawer,.sa-back{animation:none}}
.sa-head{display:flex;align-items:center;gap:10px;padding:14px 18px;flex:none}.sa-head .sa-title{flex:1;font-size:19px}
.sa-x{border:0;background:rgba(127,127,127,.14);color:inherit;border-radius:999px;width:38px;height:38px;font-size:19px;line-height:1;cursor:pointer;flex:none;transition:background .15s,transform .2s}.sa-x:hover{background:rgba(127,127,127,.24);transform:rotate(90deg)}
.sa-body{flex:1;overflow-y:auto;padding:4px 18px 22px;display:grid;gap:18px;align-content:start}
/* who is signed in: a coloured banner, or a plain line with tiles */
.sa-hero{position:relative;overflow:hidden;border-radius:calc(var(--sa-r) + 6px);padding:20px;background:linear-gradient(135deg,var(--sa-acc),color-mix(in srgb,var(--sa-acc) 68%,#000));color:var(--sa-on);display:grid;gap:16px}
.sa-hero::after{content:"";position:absolute;right:-50px;top:-70px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.1);pointer-events:none}.sa-hero::before{content:"";position:absolute;right:40px;bottom:-90px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.07);pointer-events:none}
.sa-me{display:flex;align-items:center;gap:13px;position:relative;z-index:1}.sa-av{width:50px;height:50px;border-radius:50%;display:grid;place-items:center;flex:none;font-family:var(--fd,inherit);font-weight:700;font-size:21px;background:rgba(255,255,255,.2);color:inherit;border:2px solid rgba(255,255,255,.35)}
.sa-me b{display:block;font-family:var(--fd,inherit);font-size:19px;line-height:1.2}.sa-me span{font-size:13px;opacity:.85}.sa-me>div{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.sa-hero .sa-link{color:inherit;opacity:.9;font-size:13px}
.sa-pills{display:flex;gap:8px;flex-wrap:wrap;position:relative;z-index:1}.sa-pill{background:rgba(255,255,255,.16);border-radius:999px;padding:7px 14px;font-size:13px;display:flex;gap:6px;align-items:baseline}.sa-pill b{font-size:16px;font-family:var(--fd,inherit)}
.sa-ui[data-head=plain] .sa-hero{background:none;color:inherit;padding:0;border-radius:0;overflow:visible}.sa-ui[data-head=plain] .sa-hero::before,.sa-ui[data-head=plain] .sa-hero::after{display:none}
.sa-ui[data-head=plain] .sa-av{background:var(--sa-tint);color:var(--sa-acc);border-color:transparent}.sa-ui[data-head=plain] .sa-pill{background:var(--surface,#fff);border:1px solid var(--line,#ddd)}
/* tabs */
.sa-tabs{display:flex;gap:4px;border-bottom:1.5px solid var(--line,#ddd);overflow-x:auto;scrollbar-width:none}.sa-tabs::-webkit-scrollbar{display:none}
.sa-tabs button{position:relative;border:0;background:none;color:var(--soft,#6b665d);font:inherit;font-size:14px;font-weight:700;padding:10px 12px 12px;cursor:pointer;white-space:nowrap;transition:color .15s}
.sa-tabs button::after{content:"";position:absolute;left:10px;right:10px;bottom:-1.5px;height:3px;border-radius:3px 3px 0 0;background:var(--sa-acc);transform:scaleX(0);transition:transform .22s cubic-bezier(.2,.8,.2,1)}
.sa-tabs button[aria-selected=true]{color:var(--text,#1b1a17)}.sa-tabs button[aria-selected=true]::after{transform:none}.sa-tabs em{font-style:normal;font-size:11px;font-weight:700;background:var(--sa-acc);color:var(--sa-on);border-radius:999px;padding:1px 7px;margin-left:6px}
.sa-ui[data-tabs=pills] .sa-tabs{border:0;gap:6px}.sa-ui[data-tabs=pills] .sa-tabs button{border-radius:999px;padding:8px 15px;background:rgba(127,127,127,.1)}.sa-ui[data-tabs=pills] .sa-tabs button::after{display:none}
.sa-ui[data-tabs=pills] .sa-tabs button[aria-selected=true]{background:var(--sa-acc);color:var(--sa-on)}.sa-ui[data-tabs=pills] .sa-tabs button[aria-selected=true] em{background:var(--sa-on);color:var(--sa-acc)}
.sa-ui[data-tabs=blocks] .sa-tabs{border:0;background:rgba(127,127,127,.1);border-radius:calc(var(--sa-r)*.7 + 2px);padding:4px;gap:2px}.sa-ui[data-tabs=blocks] .sa-tabs button{flex:1;border-radius:calc(var(--sa-r)*.55 + 1px);padding:9px 10px}.sa-ui[data-tabs=blocks] .sa-tabs button::after{display:none}
.sa-ui[data-tabs=blocks] .sa-tabs button[aria-selected=true]{background:var(--surface,#fff);box-shadow:0 2px 8px -3px rgba(0,0,0,.25)}
/* orders */
.sa-orders{display:grid;gap:12px}.sa-o{background:var(--surface,#fff);border-radius:calc(var(--sa-r) + 2px);overflow:hidden;border:1px solid var(--line,#ddd);transition:box-shadow .2s,transform .2s}
.sa-ui[data-cards=shadow] .sa-o,.sa-ui[data-cards=shadow] .sa-addr{border-color:transparent;box-shadow:0 1px 2px rgba(0,0,0,.06),0 10px 28px -18px rgba(0,0,0,.4)}.sa-ui[data-cards=shadow] .sa-o:hover{transform:translateY(-1px);box-shadow:0 1px 2px rgba(0,0,0,.06),0 16px 34px -18px rgba(0,0,0,.45)}
.sa-ui[data-cards=filled] .sa-o,.sa-ui[data-cards=filled] .sa-addr{border-color:transparent;background:color-mix(in srgb,var(--sa-acc) 7%,var(--surface,#fff))}
.sa-o>button{display:grid;grid-template-columns:auto 1fr auto;gap:2px 12px;align-items:center;width:100%;text-align:left;border:0;background:none;color:inherit;font:inherit;padding:14px 16px;cursor:pointer}
.sa-thumbs{grid-row:1/3;display:flex}.sa-thumbs img,.sa-thumbs i{width:46px;height:46px;border-radius:calc(var(--sa-r)*.5 + 3px);object-fit:cover;border:2px solid var(--surface,#fff);background:var(--sa-tint);margin-left:-16px;display:grid;place-items:center;font-style:normal;font-size:13px;font-weight:700;color:var(--sa-acc)}.sa-thumbs>:first-child{margin-left:0}
.sa-o b{font-size:14.5px}.sa-o .sa-when{grid-column:2;font-size:12.5px;color:var(--soft,#6b665d)}.sa-o .sa-amt{font-weight:800;text-align:right;font-family:var(--fd,inherit);font-size:16px}
.sa-chip{justify-self:end;font-size:11.5px;font-weight:700;border-radius:999px;padding:3px 10px;background:var(--sa-tint);color:var(--sa-acc);white-space:nowrap}.sa-chip[data-s=done]{background:rgba(30,122,70,.14);color:#1e7a46}.sa-chip[data-s=cancelled]{background:rgba(179,38,30,.12);color:#b3261e}
.sa-more{padding:2px 16px 16px;display:grid;gap:12px}.sa-lines{margin:0;padding:0;list-style:none;display:grid;gap:8px}.sa-lines li{display:grid;grid-template-columns:auto 1fr auto;gap:11px;align-items:center;font-size:14px}
.sa-lines img,.sa-lines i{width:40px;height:40px;border-radius:calc(var(--sa-r)*.4 + 3px);object-fit:cover;background:var(--sa-tint)}.sa-more pre{margin:0;white-space:pre-wrap;font:inherit;font-size:13px;color:var(--soft,#6b665d)}
.sa-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.sa-btn{border:1.5px solid var(--line,#ddd);background:transparent;color:inherit;border-radius:999px;padding:9px 16px;font:inherit;font-weight:700;font-size:13.5px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:7px;transition:border-color .15s,filter .15s}.sa-btn:hover{border-color:var(--sa-acc)}.sa-btn svg{width:15px;height:15px}
.sa-btn.pri{background:var(--sa-bb);color:var(--sa-bf);border-color:transparent;padding:12px 22px;font-size:14.5px}
/* where the order is: a bar with a dot per step, or the steps one under another */
.sa-bar{display:grid;gap:10px}.sa-bar ol{list-style:none;margin:0;padding:0;display:flex;align-items:center}.sa-bar li{flex:1;display:flex;align-items:center}.sa-bar li:last-child{flex:none}
.sa-bar li::before{content:"";width:14px;height:14px;border-radius:50%;border:2px solid var(--line,#ccc);background:var(--surface,#fff);box-sizing:border-box;flex:none;transition:background .3s,border-color .3s}
.sa-bar li::after{content:"";flex:1;height:3px;background:var(--line,#ccc);border-radius:3px;margin:0 3px}.sa-bar li:last-child::after{display:none}
.sa-bar li[data-on]::before{background:var(--sa-acc);border-color:var(--sa-acc)}.sa-bar li[data-done]::after{background:var(--sa-acc)}.sa-bar li[data-now]::before{box-shadow:0 0 0 5px var(--sa-tint);animation:sa-pulse 1.8s ease-in-out infinite}
@keyframes sa-pulse{50%{box-shadow:0 0 0 9px transparent}}@media (prefers-reduced-motion:reduce){.sa-bar li[data-now]::before{animation:none}}
.sa-bar li span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.sa-now{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.sa-now b{font-family:var(--fd,inherit);font-size:17px}.sa-now span{font-size:12.5px;color:var(--soft,#6b665d);white-space:nowrap}
.sa-track{display:grid;gap:0;margin:2px 0 0;padding:0;list-style:none}.sa-track li{display:grid;grid-template-columns:18px 1fr;gap:10px;align-items:start;font-size:13.5px;color:var(--soft,#6b665d);padding-bottom:10px;position:relative}
.sa-track li::before{content:"";width:12px;height:12px;border-radius:50%;border:2px solid var(--line,#ccc);background:var(--surface,#fff);margin:3px 0 0 1px;box-sizing:border-box}
.sa-track li::after{content:"";position:absolute;left:6.5px;top:17px;bottom:-1px;width:2px;background:var(--line,#ccc)}.sa-track li:last-child{padding-bottom:0}.sa-track li:last-child::after{display:none}
.sa-track li[data-on]{color:inherit;font-weight:600}.sa-track li[data-on]::before{background:var(--sa-acc);border-color:var(--sa-acc)}.sa-track li[data-done]::after{background:var(--sa-acc)}.sa-track li[data-now]::before{box-shadow:0 0 0 4px var(--sa-tint)}
.sa-form{display:grid;gap:14px}.sa-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media (max-width:420px){.sa-two{grid-template-columns:1fr}}
.sa-addr{border:1px solid var(--line,#ddd);background:var(--surface,#fff);border-radius:calc(var(--sa-r) + 2px);padding:16px;display:grid;gap:12px}.sa-addr .sa-row{justify-content:space-between}.sa-addr b{font-size:13.5px}
.sa-empty{border-radius:calc(var(--sa-r) + 2px);padding:30px 22px;text-align:center;color:var(--soft,#6b665d);font-size:14px;background:var(--sa-tint);display:grid;gap:8px;justify-items:center}.sa-empty svg{width:34px;height:34px;color:var(--sa-acc);opacity:.8}
.sa-sub{font-family:var(--fd,inherit);font-weight:700;font-size:16px}
`;
  const IC = {
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1 12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1Z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 19.5h14"/></svg>',
  };
  /** The owner's choices for the look (content.account.ui), as attributes for the panel and the sign-in card. */
  const U = () => (cfg && cfg.ui) || {};
  const pickOf = (v, list) => (list.includes(v) ? v : list[0]);
  const looks = () => { const u = U(); return ` data-tone="${pickOf(u.tone, ["accent", "ink", "soft"])}" data-head="${pickOf(u.head, ["banner", "plain"])}" data-cards="${pickOf(u.cards, ["shadow", "outline", "filled"])}" data-corners="${pickOf(u.corners, ["theme", "soft", "round", "sharp"])}" data-tabs="${pickOf(u.tabs, ["underline", "pills", "blocks"])}"`; };
  function style() { if (document.getElementById("sa-css")) return; const s = document.createElement("style"); s.id = "sa-css"; s.textContent = CSS; document.head.appendChild(s); }

  const kinds = () => (can ? [can.phone && can.phone.length ? "phone" : "", can.email ? "email" : ""].filter(Boolean) : []);
  const tab = () => (kinds().includes(ui.tab) ? ui.tab : kinds()[0] || "phone");
  const viaNow = () => (can && can.phone.includes(ui.via) ? ui.via : (can && can.phone[0]) || "wa");
  const show = (k) => (/@/.test(k) ? k : "+" + k);
  const pic = (p) => (p && cfg.img ? cfg.img(p) : "");
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };

  /** The sign-in step: one box for the number or the address, then the code. New and returning customers alike. */
  function formHTML(card) {
    const t = tab(), ks = kinds(), phone = t === "phone";
    const box = ui.sent
      ? `<div class="sa-f"><label for="sa-code">Code we sent ${phone ? VIA[viaNow()] : "to your email"}</label><div class="sa-in"><input id="sa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="Enter the code"><button type="button" data-sa="check"${ui.busy ? " disabled" : ""}>Continue</button></div></div>
         <p class="sa-soft">Sent to <b>${esc(ui.val)}</b>. <button type="button" class="sa-link" data-sa="again">Change</button> · <button type="button" class="sa-link" data-sa="send">Send a new code</button></p>`
      : `<div class="sa-f"><label for="sa-val">${phone ? "Mobile number" : "Email address"}</label><div class="sa-in"><input id="sa-val" ${phone ? 'type="tel" inputmode="tel" autocomplete="tel" placeholder="Your mobile number"' : 'type="email" autocomplete="email" placeholder="you@example.com"'} value="${esc(ui.val)}"><button type="button" data-sa="send"${ui.busy ? " disabled" : ""}>Send code</button></div></div>
         ${phone && can.phone.length > 1 ? `<div class="sa-seg sm" role="group" aria-label="Send the code">${can.phone.map((v) => `<button type="button" data-sa="via" data-v="${v}" aria-pressed="${viaNow() === v}">${v === "wa" ? "WhatsApp" : "SMS"}</button>`).join("")}</div>` : ""}
         <p class="sa-soft sa-safe">${IC.lock}<span>We send a one-time code ${phone ? can.phone.map((v) => VIA[v]).join(" or ") : "to this address"}. No password to remember.</span></p>`;
    const u = U(), title = String(u.signTitle || "").trim() || "Sign in or create your account", text = String(u.signText || "").trim() || `New here? It is the same step: enter your ${ks.length > 1 ? "mobile number or email" : phone ? "mobile number" : "email address"} and we set you up.`;
    return `<div class="sa sa-ui${card ? " sa-card" : ""}"${looks()} data-sa-form><span class="sa-badge">${IC.user}</span><div><h3>${esc(title)}</h3><p class="sa-soft" style="margin-top:6px">${esc(text)}</p></div>
      ${ks.length > 1 && !ui.sent ? `<div class="sa-seg" role="group" aria-label="Sign in with">${ks.map((k) => `<button type="button" data-sa="tab" data-v="${k}" aria-pressed="${t === k}">${k === "phone" ? "Mobile" : "Email"}</button>`).join("")}</div>` : ""}
      ${box}${ui.msg ? `<p class="sa-bad" role="alert">${esc(ui.msg)}</p>` : ""}</div>`;
  }

  /* ---- My account: the order in progress, the history, the profile */
  const thumbs = (o) => { const it = (o.items || []).slice(0, 3); return `<span class="sa-thumbs">${it.length ? it.map((x) => (pic(x.i) ? `<img src="${esc(pic(x.i))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<i>${esc(String(x.n || "?").slice(0, 1).toUpperCase())}</i>`)).join("") + ((o.items || []).length > 3 ? `<i>+${o.items.length - 3}</i>` : "") : `<i>#</i>`}</span>`; };
  const lines = (o) => ((o.items || []).length ? `<ul class="sa-lines">${o.items.map((x) => `<li>${pic(x.i) ? `<img src="${esc(pic(x.i))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<i></i>`}<span>${esc(x.n)}</span><b>× ${x.q}</b></li>`).join("")}</ul>` : o.text ? `<pre>${esc(o.text)}</pre>` : "");
  function track(o) {
    if (o.status === "cancelled") return `<p class="sa-bad">This order was cancelled.</p>`;
    const at = LIVE[o.status] || 0, keep = (i) => !(cfg.kind !== "store" && i === 4 && !/deliver/i.test(o.mode || "")), idx = steps().map((_, i) => i).filter(keep), S = idx.map((i) => steps()[i]);
    const li = (s, k) => `<li${idx[k] <= at ? " data-on" : ""}${idx[k] < at ? " data-done" : ""}${idx[k] === at ? ' data-now aria-current="step"' : ""}>`;
    if (pickOf(U().track, ["bar", "steps"]) === "steps") return `<ol class="sa-track" aria-label="Where this order is">${S.map((s, k) => li(s, k) + esc(s) + "</li>").join("")}</ol>`;
    const now = Math.max(0, idx.indexOf(at) < 0 ? idx.filter((i) => i <= at).length - 1 : idx.indexOf(at)), next = S[now + 1];
    return `<div class="sa-bar"><div class="sa-now"><b>${esc(S[now])}</b><span>Step ${now + 1} of ${S.length}${next ? " · next: " + esc(next) : ""}</span></div><ol aria-label="Where this order is">${S.map((s, k) => li(s, k) + `<span>${esc(s)}</span></li>`).join("")}</ol></div>`;
  }
  function orderHTML(o, live) {
    const open = live || ui.open === o.no, t = cfg.track && cfg.track(o);
    return `<div class="sa-o" data-order="${esc(o.no)}"><button type="button" data-sa="toggle" data-v="${esc(o.no)}" aria-expanded="${open}">${thumbs(o)}<b>${esc(o.no)}</b><span class="sa-amt">${esc(o.total)}</span><span class="sa-when">${esc(when(o.at))}${o.mode ? " · " + esc(o.mode) : ""}</span><span class="sa-chip" data-s="${esc(o.status === "cancelled" ? "cancelled" : (LIVE[o.status] || 0) >= 5 ? "done" : "")}">${esc(label(o))}${o.paid ? " · Paid" : ""}</span></button>
      ${open ? `<div class="sa-more">${live ? track(o) : ""}${o.track ? `<p class="sa-soft" data-sa-ship>Shipped with <b>${esc(o.track.name)}</b>${o.track.awb ? `, tracking number <b style="font-family:ui-monospace,monospace">${esc(o.track.awb)}</b>` : ""}. <button type="button" class="sa-btn" data-sa="ship" data-v="${esc(o.no)}">Track parcel</button></p><div data-sa-shipout="${esc(o.no)}"></div>` : ""}${lines(o)}${o.points ? `<p class="sa-soft" style="font-weight:600">${esc(o.points)}</p>` : ""}<div class="sa-row"><button type="button" class="sa-btn" data-sa="bill" data-v="${esc(o.no)}">${IC.down}Download bill</button>${t ? `<a class="sa-btn" href="${esc(t)}">Open tracking page</a>` : ""}</div></div>` : ""}</div>`;
  }
  /* Where a shipped order's parcel is: each scan the shop's tracking service has, newest first (else the courier's own page). */
  function shipDraw(o, el) {
    const t = o.track, link = t && /^https:\/\//.test(t.link || "") ? t.link : "";
    const fall = (why) => { el.innerHTML = `<p class="sa-soft">${esc(why)}${link ? ` <a href="${esc(link)}" target="_blank" rel="noopener">Track on ${esc(t.name)}'s site ↗</a>` : ""}</p>`; };
    if (cfg.demo || !me) return fall("Live tracking shows on the published site.");
    el.innerHTML = `<p class="sa-soft">Asking the courier…</p>`;
    const dt = (v) => { const d = new Date(v); return !v ? "" : isNaN(+d) ? String(v) : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); };
    real("track", { no: o.no, key: me.key, pass: me.pass }).then((r) => r.json().then((j) => ({ r, j }))).then(({ r, j }) => {
      const L = r.ok && j && j.live; if (!L) return fall("The courier's own page has the latest.");
      el.innerHTML = `<div class="sa-ship"><p><b>${esc(L.label || L.say)}</b>${L.eta ? ` <span class="sa-soft">· expected by ${esc(new Date(L.eta).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }))}</span>` : ""}</p>${(L.ev || []).length ? `<ol class="sa-track" aria-label="Parcel history">${L.ev.slice(0, 12).map((e, i) => `<li${i === 0 ? " data-on data-now" : ""}><span><b style="font-weight:600;color:inherit">${esc(e.text)}</b><br><span class="sa-soft" style="font-weight:400">${esc([e.place, dt(e.at)].filter(Boolean).join(" · "))}</span></span></li>`).join("")}</ol>` : ""}${link || L.link ? `<p><a href="${esc(L.link || link)}" target="_blank" rel="noopener">Track on ${esc(t.name)}'s site ↗</a></p>` : ""}</div>`;
    }).catch(() => fall("We couldn't reach the courier just now."));
  }
  const blankAddr = () => ({ label: "", line1: "", line2: "", city: "", pin: "", state: "" });
  function profileHTML(d) {
    const byMail = me.kind === "email", A = ui.addrs || (ui.addrs = (d.addresses && d.addresses.length ? d.addresses : [blankAddr()]).map((a) => ({ ...blankAddr(), ...a }))), many = !!cfg.addresses;
    const ASK = cfg.ask || {}, f = (id, lab, val, more) => `<div class="sa-f"><label for="${id}">${lab}</label><input id="${id}" value="${esc(val || "")}" ${more || ""}></div>`;
    return `<form class="sa-form" data-sa-profile novalidate>
      ${f("sa-name", "Name", d.name, 'autocomplete="name" maxlength="100"')}
      <div class="sa-two">${f("sa-phone", "Mobile number", d.phone, byMail ? 'type="tel" inputmode="tel" autocomplete="tel"' : "readonly")}${f("sa-email", "Email address", d.email, byMail ? "readonly" : 'type="email" autocomplete="email"')}</div>
      <p class="sa-soft">You sign in with your ${byMail ? "email address" : "mobile number"}, so that one can't be changed here.</p>
      ${ASK.dob || ASK.gender ? `<div class="sa-two">${ASK.dob ? f("sa-dob", "Date of birth", d.dob, `type="date" max="${new Date().toISOString().slice(0, 10)}" min="1900-01-01" autocomplete="bday"`) : ""}${ASK.gender ? `<div class="sa-f"><label for="sa-gender">Gender</label><select id="sa-gender"><option value="">Prefer not to say</option>${[["female", "Female"], ["male", "Male"], ["other", "Other"]].map(([k, l]) => `<option value="${k}"${d.gender === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>` : ""}</div>` : ""}
      <p class="sa-sub">${many ? "Saved addresses" : "Your address"}</p>
      ${A.map((a, i) => `<div class="sa-addr" data-addr="${i}">${many ? `<div class="sa-row"><b>Address ${i + 1}</b>${A.length > 1 ? `<button type="button" class="sa-link" data-sa="deladdr" data-v="${i}">Remove</button>` : ""}</div>${f("sa-a-label-" + i, "Name for it (optional)", a.label, 'placeholder="Home, Office…" maxlength="30"')}` : ""}
        ${f("sa-a-line1-" + i, "Address", a.line1, 'autocomplete="address-line1"')}${f("sa-a-line2-" + i, "Area or landmark (optional)", a.line2, 'autocomplete="address-line2"')}
        <div class="sa-two">${f("sa-a-city-" + i, "City", a.city, 'autocomplete="address-level2"')}${f("sa-a-pin-" + i, "PIN code", a.pin, 'inputmode="numeric" autocomplete="postal-code"')}</div>${many ? f("sa-a-state-" + i, "State", a.state, 'autocomplete="address-level1"') : ""}</div>`).join("")}
      ${many && A.length < 6 ? `<button type="button" class="sa-link" data-sa="addaddr">+ Add another address</button>` : ""}
      ${ui.msg ? `<p class="sa-bad" role="alert">${esc(ui.msg)}</p>` : ui.saved ? `<p class="sa-good" role="status">${esc(ui.saved)}</p>` : ""}
      <div class="sa-row"><button type="button" class="sa-btn pri" data-sa="save"${ui.busy ? " disabled" : ""}>${ui.busy ? "Saving…" : "Save"}</button></div></form>`;
  }
  function acctHTML() {
    const d = data;
    if (!d) return `<div class="sa" role="status" aria-label="Loading your account"><i class="sa-sk t"></i><i class="sa-sk h"></i><i class="sa-sk"></i><i class="sa-sk"></i></div>`;
    if (d.error) return `<div class="sa"><p class="sa-bad" role="alert">${esc(d.error)}</p></div>`;
    let live = d.orders.filter(active), past = d.orders.filter((o) => !active(o)), view = ui.view || (live.length ? "now" : ["orders", "profile"].includes(U().startView) ? U().startView : "orders"), T = (k, d) => String(U()[k] || "").trim() || d;
    const L = d.loyalty, worth = L && L.worth > 0 ? Math.round(d.points * L.worth * 100) / 100 : 0, m = cfg.money || ((n) => String(n));
    const tabs = [["now", T("tabNow", "Current order" + (live.length > 1 ? "s" : ""))], ["orders", T("tabOrders", "Order history")], ["profile", T("tabProfile", "Profile")]].filter((x) => !(x[0] === "now" && U().hideNow === true)), nm = String(d.name || "").trim();
    if (U().hideNow === true && view === "now") view = "orders";
    return `<div class="sa"><div class="sa-hero"><div class="sa-me"><span class="sa-av" aria-hidden="true">${esc((nm || show(me.key).replace(/^\+/, "")).slice(0, 1).toUpperCase())}</span><div><b>${nm ? esc(T("hello", "Hi, {name}").replace(/\{name\}/g, nm.split(" ")[0])) : esc(T("welcome", "Welcome"))}</b><span>${esc(show(me.key))}</span></div><button type="button" class="sa-link" data-sa="out">Sign out</button></div>
      <div class="sa-pills"${U().hidePills === true ? " hidden" : ""}>${L ? `<span class="sa-pill"><b>${d.points}</b>point${d.points === 1 ? "" : "s"}${worth ? ` · worth up to ${esc(m(worth))}` : ""}</span>` : ""}<span class="sa-pill"><b>${d.count}</b>order${d.count === 1 ? "" : "s"}</span></div></div>
      <div class="sa-tabs" role="tablist" aria-label="My account">${tabs.map(([k, l]) => `<button type="button" role="tab" data-sa="view" data-v="${k}" aria-selected="${view === k}">${l}${k === "now" && live.length ? `<em>${live.length}</em>` : ""}</button>`).join("")}</div>
      ${view === "now" ? (live.length ? `<div class="sa-orders">${live.map((o) => orderHTML(o, true)).join("")}</div><p class="sa-soft">This updates by itself while it is open.</p>` : `<div class="sa-empty">${IC.bag}<span>${esc(T("emptyNow", "No order in progress."))}</span></div>`)
        : view === "orders" ? (past.length || live.length ? `<div class="sa-orders">${[...live, ...past].map((o) => orderHTML(o, false)).join("")}</div>` : `<div class="sa-empty">${IC.bag}<span>${esc(T("emptyOrders", "No orders yet. They show here once you place one while signed in."))}</span></div>`)
        : profileHTML(d)}</div>`;
  }
  function draw() {
    style();
    if (where && document.contains(where) && !me) where.innerHTML = formHTML(true);
    if (modal) { const b = modal.querySelector(".sa-body"), y = b.scrollTop; b.innerHTML = me ? acctHTML() : formHTML(false); b.scrollTop = y; modal.querySelector(".sa-title").textContent = me ? "My account" : ""; }
  }
  const keepVal = () => { const i = document.getElementById("sa-val"); if (i) ui.val = i.value.trim(); };
  /** What is typed in the profile form, read back into the working copy (so a redraw keeps it). */
  function readProfile() {
    const v = (id) => String((document.getElementById(id) || {}).value || "").trim(); if (!document.getElementById("sa-name") || !data || data.error) return;
    data.name = v("sa-name"); if (document.getElementById("sa-dob")) data.dob = v("sa-dob"); if (document.getElementById("sa-gender")) data.gender = v("sa-gender"); if (me.kind === "email") data.phone = v("sa-phone"); else data.email = v("sa-email");
    (ui.addrs || []).forEach((a, i) => { for (const k of ["label", "line1", "line2", "city", "pin", "state"]) if (document.getElementById("sa-a-" + k + "-" + i)) a[k] = v("sa-a-" + k + "-" + i); });
  }
  /** Ready-made invoice styles: a layout, a colour and a font in one choice (the owner's own choices still win). */
  var INV_THEMES = { corporate: { layout: "modern", accent: "#1D4ED8" }, ink: { layout: "classic", accent: "#14171C" }, sunset: { layout: "bold", accent: "#E4572E" }, emerald: { layout: "minimal", accent: "#0F766E" }, royal: { layout: "modern", accent: "#6D28D9", font: "serif" }, receipt: { layout: "ledger", accent: "#14171C", font: "mono" }, boutique: { layout: "minimal", accent: "#9D174D", font: "serif" } };
  var INV_LAYOUTS = ["classic", "modern", "minimal", "bold", "ledger"];
  function invCss(I) {
    I = I || {}; var P = INV_THEMES[I.theme] || {}, fo = I.font || P.font || "";
    var lay = INV_LAYOUTS.indexOf(I.layout) >= 0 ? I.layout : INV_LAYOUTS.indexOf(P.layout) >= 0 ? P.layout : "classic", ac = /^#[0-9a-f]{6}$/i.test(I.accent || "") ? I.accent : P.accent || "#14171c";
    var ff = fo === "serif" ? "Georgia,'Times New Roman',serif" : fo === "mono" ? "ui-monospace,'SF Mono',Menlo,Consolas,monospace" : "";
    var tint = "color-mix(in srgb," + ac + " 12%,#fff)";
    var css = ":root{--ac:" + ac + "}" + (ff ? "body,.sheet,button{font-family:" + ff + "!important}" : "");
    if (lay === "modern") css += ".top{background:var(--ac)!important;color:#fff;border:0!important;border-radius:12px;padding:22px 26px!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.top *{color:#fff!important}.top h1{font-size:26px}th{background:" + tint + "!important;color:var(--ac)!important;border:0!important}td{border-bottom:1px solid #eef0f3!important}.tot .g{color:var(--ac);border-top:2px solid var(--ac)!important}.words{background:" + tint + "!important}h2{color:var(--ac)!important}.sheet{border-radius:14px}";
    else if (lay === "minimal") css += ".sheet{padding:52px 56px!important}h1{font-weight:300!important;letter-spacing:.28em!important;text-transform:uppercase;font-size:20px!important}.top{border-bottom:1px solid #cfd3d9!important}th{background:none!important;border-bottom:1px solid #14171c!important;color:#14171c!important;font-weight:600}td{border-bottom:1px solid #f0f1f3!important}.words{background:none!important;padding:10px 0!important;border-top:1px solid #e5e7eb;border-radius:0}.tot .g{border-top:1px solid #14171c!important}h2{color:var(--ac)!important;font-weight:600}";
    else if (lay === "bold") css += "h1{font-size:36px!important;font-weight:900!important;text-transform:uppercase;color:var(--ac);line-height:1}.top{border-bottom:8px solid var(--ac)!important;padding-bottom:20px!important}th{background:#14171c!important;color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.tot .g{background:var(--ac);color:#fff;padding:10px 12px!important;border:0!important;border-radius:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact}h2{color:var(--ac)!important}.words{border-left:5px solid var(--ac);border-radius:0!important}";
    else if (lay === "ledger") css += "body{font-size:12.5px!important}.sheet{padding:26px 28px!important}.top{border:1px solid #14171c!important;padding:14px!important}table,th,td{border:1px solid #14171c!important}th,td{padding:5px 7px!important}th{background:" + tint + "!important;color:#14171c!important}.tot{border:1px solid #14171c;padding:6px 10px}.tot .g{border-top:1px solid #14171c!important}.words{border:1px solid #14171c;background:none!important;border-radius:0!important}";
    else if (ac !== "#14171c") css += ".top{border-bottom-color:var(--ac)!important}.tot .g{border-top-color:var(--ac)!important}h2{color:var(--ac)!important}th{color:var(--ac)!important}";
    if (I.words === false) css += ".words{display:none!important}";
    if (I.summary === false) css += ".taxsum{display:none!important}";
    if (I.sign === false) css += ".sign{display:none!important}";
    return css;
  }

  /** A bill for one order: a page of its own that prints (or saves as a PDF) cleanly. */
  function bill(o) {
    if (cfg.gstBill && cfg.gstBill(o)) return; // a GST invoice, when the site offers one
    const B = cfg.biz || {}, rows = (o.items || []).length ? `<table><thead><tr><th>Item</th><th class="r">Qty</th></tr></thead><tbody>${o.items.map((x) => `<tr><td>${esc(x.n)}</td><td class="r">${x.q}</td></tr>`).join("")}</tbody></table>` : "";
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bill ${esc(o.no)}</title><style>
body{font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#111;margin:0;padding:32px;max-width:760px;margin-inline:auto}h1{font-size:22px;margin:0}h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#666;margin:22px 0 6px}
.top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:16px}.top p{margin:2px 0;color:#444;font-size:13.5px}.r{text-align:right}
table{width:100%;border-collapse:collapse;margin-top:6px}th,td{padding:8px 0;border-bottom:1px solid #ddd;text-align:left;font-size:14px}th{font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:#666}
pre{white-space:pre-wrap;font:inherit;font-size:14px;margin:6px 0 0}.tot{display:flex;justify-content:space-between;font-size:18px;font-weight:700;border-top:2px solid #111;margin-top:18px;padding-top:12px}
.note{color:#666;font-size:12.5px;margin-top:26px}button{font:inherit;font-weight:700;padding:10px 18px;border-radius:999px;border:1px solid #111;background:#111;color:#fff;cursor:pointer;margin-top:22px}@media print{button{display:none}body{padding:0}}
${invCss(B.inv)}</style></head><body><div class="top"><div>${B.inv && B.inv.logo === true && B.logo ? `<img src="${esc((() => { try { return new URL(String(B.logo), location.href).href; } catch (e) { return ""; } })())}" alt="" style="height:44px;max-width:180px;object-fit:contain;display:block;margin:0 0 8px">` : ""}<h1>${esc(B.name || "")}</h1>${B.address ? `<p>${esc(B.address)}</p>` : ""}${B.phone ? `<p>${esc(B.phone)}</p>` : ""}${B.email ? `<p>${esc(B.email)}</p>` : ""}${B.gstin ? `<p>GSTIN: ${esc(B.gstin)}</p>` : ""}</div><div class="r"><p><b>Bill</b></p><p>${esc(o.no)}</p><p>${esc(when(o.at))}</p><p>${esc(label(o))}${o.paid ? " · Paid" : ""}</p></div></div>
<h2>Billed to</h2><p>${esc(o.name || (data && data.name) || "")}<br>${esc(show(me.key))}${o.address ? "<br>" + esc(o.address) : ""}</p>
<h2>Order${o.mode ? " · " + esc(o.mode) : ""}</h2>${rows}${o.text ? `<pre>${esc(o.text)}</pre>` : ""}
<div class="tot"><span>Total${o.pay ? ` <span style="font-weight:400;font-size:13.5px;color:#666">· ${esc(o.pay)}</span>` : ""}</span><span>${esc(o.total)}</span></div>
${B.inv && B.inv.terms ? `<h2>Terms</h2><p class="note" style="margin-top:4px">${esc(B.inv.terms).replace(/\n/g, "<br>")}</p>` : ""}${B.inv && B.inv.thanks ? `<p style="text-align:center;font-weight:700;margin-top:22px">${esc(B.inv.thanks)}</p>` : ""}<p class="note">${B.inv && String(B.inv.footer || "").trim() ? esc(B.inv.footer) : `This bill is made from your order as it was placed${B.gstin ? "" : ". It is not a tax invoice"}.`}</p><button onclick="print()">Print or save as PDF</button></body></html>`;
    const blob = new Blob([html], { type: "text/html" }), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "Bill-" + String(o.no).replace(/[^\w-]+/g, "") + ".html"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function act(a, v) {
    if (a === "close") return shut();
    if (a === "out") { out(); return; }
    if (a === "toggle") { ui.open = ui.open === v ? "" : v; return draw(); }
    if (a === "view") { readProfile(); ui.view = v; ui.msg = ""; ui.saved = ""; return draw(); }
    if (a === "bill") { const o = data && data.orders.find((x) => x.no === v); if (o) bill(o); return; }
    if (a === "ship") { const o = data && data.orders.find((x) => x.no === v), el = modal && [].find.call(modal.querySelectorAll("[data-sa-shipout]"), (n) => n.getAttribute("data-sa-shipout") === v); if (o && el) shipDraw(o, el); return; }
    if (a === "addaddr") { readProfile(); ui.addrs.push(blankAddr()); return draw(); }
    if (a === "deladdr") { readProfile(); ui.addrs.splice(+v, 1); return draw(); }
    if (a === "save") {
      readProfile(); ui.msg = ""; ui.saved = ""; ui.busy = true; draw();
      try { const r = await post("acct/save", { key: me.key, pass: me.pass, name: data.name, phone: data.phone, email: data.email, addresses: ui.addrs, ...((cfg.ask || {}).dob ? { dob: data.dob || "" } : {}), ...((cfg.ask || {}).gender ? { gender: data.gender || "" } : {}) }), j = await r.json().catch(() => null);
        if (r.status === 401) { ui.busy = false; out(); return; }
        if (!r.ok || !j || !j.profile) ui.msg = (j && j.error) || "Couldn't save that. Please try again.";
        else { Object.assign(data, j.profile); ui.addrs = null; ui.saved = "Saved."; keepProfile(); changed(); }
      } catch (e) { ui.msg = "Couldn't reach us just now. Check your connection."; }
      ui.busy = false; return draw();
    }
    if (a === "tab") { keepVal(); ui.tab = v; ui.val = ""; ui.msg = ""; return draw(); }
    if (a === "via") { keepVal(); ui.via = v; return draw(); }
    if (a === "again") { ui.sent = false; ui.msg = ""; return draw(); }
    const phone = tab() === "phone"; keepVal();
    const code = String((document.getElementById("sa-code") || {}).value || "").trim();
    if (a === "send") {
      if (phone ? digits(ui.val).length < 8 : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ui.val)) { ui.msg = phone ? "Enter your mobile number." : "Enter your email address."; return draw(); }
    } else if (!/^\d{4,8}$/.test(code)) { ui.msg = "Enter the code."; return draw(); }
    ui.msg = ""; ui.busy = true; draw();
    try {
      const body = phone ? { phone: ui.val, code, via: viaNow() } : { email: ui.val, code };
      const r = await post((phone ? "otp/" : "eotp/") + (a === "send" ? "send" : "check"), body), j = await r.json().catch(() => null);
      if (!r.ok) ui.msg = (j && j.error) || "That didn't work. Please try again.";
      else if (a === "send" && j && j.skip) { // no code can be emailed just now: the order isn't held up, but there is no account to open
        skip = { email: ui.val.toLowerCase(), token: "s:" + j.skip }; ui.busy = false; shut(); changed(); return; }
      else if (a === "send") { ui.sent = true; if (j && j.via) ui.via = j.via; }
      else {
        const r2 = await post("acct/in", phone ? { phone: ui.val, otp: j.token } : { email: ui.val, eotp: j.token }), j2 = await r2.json().catch(() => null);
        if (!r2.ok || !j2 || !j2.pass) ui.msg = (j2 && j2.error) || "Couldn't sign you in. Please try again.";
        else { me = { key: j2.key, kind: j2.kind, pass: j2.pass, typed: ui.val }; if (cfg.demo) demoMe = me; else try { localStorage.setItem(key(), JSON.stringify(me)); } catch (e) { /* private window */ } ui.sent = false; ui.val = ""; ui.busy = false; ui.view = ""; data = null; draw(); await load(); changed(); return; }
      }
    } catch (e) { ui.msg = "Couldn't reach us just now. Check your connection."; }
    ui.busy = false; draw(); const f = document.getElementById(ui.sent ? "sa-code" : "sa-val"); if (f) f.focus();
  }
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("[data-sa]"); if (!b || !cfg) return; e.preventDefault(); act(b.getAttribute("data-sa"), b.getAttribute("data-v")); });
  document.addEventListener("keydown", (e) => { if (!cfg) return; if (e.key === "Escape" && modal) return shut(); if (e.key !== "Enter") return; const id = e.target && e.target.id; if (id === "sa-val") { e.preventDefault(); act("send"); } else if (id === "sa-code") { e.preventDefault(); act("check"); } else if (e.target.closest && e.target.closest("[data-sa-profile]")) { e.preventDefault(); act("save"); } });
  function changed() { try { cfg.onChange && cfg.onChange(me); } catch (e) { /* the page's own business */ } }

  /* The profile is kept on the device too, so a checkout can fill itself in before the account has loaded. */
  let prof = null;
  function keepProfile() { prof = data && !data.error ? { name: data.name || "", phone: data.phone || "", email: data.email || "", addresses: data.addresses || [], dob: data.dob || "", gender: data.gender || "", favs: Array.isArray(data.favs) ? data.favs : (prof && prof.favs) || [] } : prof; try { if (prof && !cfg.demo) localStorage.setItem(key() + ":p", JSON.stringify(prof)); } catch (e) { /* private window */ } }
  async function load(quiet) {
    if (!me) return;
    try { const r = await post("acct/me", { key: me.key, pass: me.pass }), j = await r.json().catch(() => null);
      if (r.status === 401) { out(); return; }
      if (r.ok && j) { const typing = quiet && data && !data.error && ui.view === "profile"; if (typing) data.orders = j.orders; else { data = j; ui.addrs = null; } keepProfile(); }
      else if (!quiet) data = { error: (j && j.error) || "Couldn't load your account just now." };
    } catch (e) { if (!quiet) data = { error: "Couldn't reach us just now. Check your connection." }; }
    if (!(quiet && ui.view === "profile")) draw();
  }
  /** The page's address with #account on the end opens this (a link to "My account" from anywhere, or from a message). */
  const asked = () => /^#account$/i.test(location.hash);
  function open(view) {
    if (!cfg || !can) return; style();
    if (!modal) { modal = document.createElement("div"); modal.className = "sa-back"; modal.setAttribute("data-panel", pickOf(U().panel, ["right", "left", "sheet", "full"])); modal.innerHTML = `<aside class="sa-drawer sa-ui"${looks()} role="dialog" aria-modal="true" aria-label="My account"><div class="sa-head"><span class="sa-title">My account</span><button type="button" class="sa-x" data-sa="close" aria-label="Close">×</button></div><div class="sa-body"></div></aside>`;
      modal.addEventListener("mousedown", (e) => { if (e.target === modal) shut(); }); document.body.appendChild(modal);
      clearInterval(timer); timer = setInterval(() => { if (modal && me && data && !data.error && data.orders.some(active)) load(true); }, 20000); }
    ui.msg = ""; ui.saved = ""; ui.view = typeof view === "string" ? view : ""; draw(); if (me) load(); else { const f = document.getElementById("sa-val"); if (f) f.focus(); }
  }
  function shut() { clearInterval(timer); if (modal) { modal.remove(); modal = null; } if (asked()) try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* the address stays */ } }
  addEventListener("hashchange", () => { if (asked() && cfg && can && !modal) open(); });
  function out() { me = null; demoMe = null; data = null; prof = null; ui.addrs = null; try { localStorage.removeItem(key()); localStorage.removeItem(key() + ":p"); } catch (e) { /* private window */ } shut(); changed(); draw(); }

  window.SiteAcct = {
    /** { api, site, kind ("restaurant" | "store"), acct (from the database's "what can this site do"), addresses (several can be kept),
     *    money(n), img(path), track(order), biz { name, address, phone, email, gstin }, onChange(user) } */
    init(o) { cfg = o; can = o.acct || null; me = null; prof = null;
      if (o.demo) { me = demoMe || (o.signedIn ? (demoMe = { key: "919876543210", kind: "phone", pass: Date.now() + 864e5 + ".demo", typed: "+91 98765 43210" }) : null); if (modal) { modal.setAttribute("data-panel", pickOf(U().panel, ["right", "left", "sheet", "full"])); const d = modal.querySelector(".sa-drawer"); for (const [k, v] of Object.entries({ tone: ["accent", "ink", "soft"], head: ["banner", "plain"], cards: ["shadow", "outline", "filled"], corners: ["theme", "soft", "round", "sharp"], tabs: ["underline", "pills", "blocks"] })) d.setAttribute("data-" + k, pickOf(U()[k], v)); draw(); } return; }
      try { me = JSON.parse(localStorage.getItem(key()) || "null"); } catch (e) { me = null; }
      if (me && !(+String(me.pass).split(".")[0] > Date.now() && me.key)) me = null;
      if (me && can && !kinds().includes(me.kind)) me = null;
      if (me) try { prof = JSON.parse(localStorage.getItem(key() + ":p") || "null"); } catch (e) { prof = null; }
      // The saved items are the account's, so they are fetched again on every visit (another device may have changed them).
      if (me && can && !o.demo) { const who = me; post("acct/me", { key: who.key, pass: who.pass }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (!j || me !== who || !Array.isArray(j.favs)) return; const was = JSON.stringify((prof && prof.favs) || []); prof = { ...(prof || { name: j.name || "", phone: j.phone || "", email: j.email || "", addresses: j.addresses || [], dob: j.dob || "", gender: j.gender || "" }), favs: j.favs }; try { localStorage.setItem(key() + ":p", JSON.stringify(prof)); } catch (e) { /* private window */ } if (JSON.stringify(j.favs) !== was) changed(); }).catch(() => {}); }
      if (asked() && can && !modal) setTimeout(open, 0); },
    /** Signing in is offered here. */
    on: () => !!(cfg && can),
    user: () => me,
    /** The signed-in customer's own details (name, contacts, addresses), as last saved or loaded; null before that. */
    profile: () => (me ? prof : null),
    /** The signed-in customer's saved items (favourite dishes, a wishlist): ids, as last loaded or saved. Empty when signed out. */
    favs: () => (me && prof && Array.isArray(prof.favs) ? prof.favs.slice() : []),
    /** Saves them with the account (and on this device meanwhile). Does nothing when signed out. */
    setFavs(list) {
      if (!me) return; const favs = [...new Set((list || []).map(String))].slice(0, 200);
      prof = { ...(prof || { name: "", phone: "", email: "", addresses: [], dob: "", gender: "" }), favs }; if (data && !data.error) data.favs = favs;
      try { if (!cfg.demo) localStorage.setItem(key() + ":p", JSON.stringify(prof)); } catch (e) { /* private window */ }
      if (!cfg.demo) post("acct/favs", { key: me.key, pass: me.pass, favs }).catch(() => {});
    },
    /** The note that no code could be emailed to this address: checkout goes ahead without an account. */
    skipped: () => skip,
    /** Draws the sign-in step into an element (the checkout, before its form). */
    gate(el) { where = el; ui.msg = ""; draw(); },
    open, out,
  };
})();

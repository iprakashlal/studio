/* GST tax invoice for a shop order. Content: content.gst = {
     on, gstin, legalName, address, state, prefix, defaultRate, defaultHsn, askGstin, pan, notes, sign }
   and each product may carry { hsn, gstRate }. The invoice is worked out from the order itself, so its total always
   equals what the customer paid:
     - prices that include tax (the usual case): each line's tax is taken out of its price at that product's rate;
     - a shop that adds one tax percentage on top (Settings → tax, not included): that rate is used for every line;
     - shipping is taxed at the highest rate on the order, inside the shipping charge.
   Same state as the seller: CGST + SGST; another state: IGST.
   window.SiteInvoice: build(order, C) → figures, html(order, C) → a full printable page, open(order, C), STATES.
   `order` = { id, at, items: [{ id, name, opt, qty, price }], t: { sub, ship, taxAdd, taxIn, total },
               c: { name, email, phone, address, city, pin, state, gstin } } */
(function () {
  "use strict";
  var STATES = [["01", "Jammu and Kashmir"], ["02", "Himachal Pradesh"], ["03", "Punjab"], ["04", "Chandigarh"], ["05", "Uttarakhand"], ["06", "Haryana"], ["07", "Delhi"], ["08", "Rajasthan"], ["09", "Uttar Pradesh"], ["10", "Bihar"], ["11", "Sikkim"], ["12", "Arunachal Pradesh"], ["13", "Nagaland"], ["14", "Manipur"], ["15", "Mizoram"], ["16", "Tripura"], ["17", "Meghalaya"], ["18", "Assam"], ["19", "West Bengal"], ["20", "Jharkhand"], ["21", "Odisha"], ["22", "Chhattisgarh"], ["23", "Madhya Pradesh"], ["24", "Gujarat"], ["26", "Dadra and Nagar Haveli and Daman and Diu"], ["27", "Maharashtra"], ["29", "Karnataka"], ["30", "Goa"], ["31", "Lakshadweep"], ["32", "Kerala"], ["33", "Tamil Nadu"], ["34", "Puducherry"], ["35", "Andaman and Nicobar Islands"], ["36", "Telangana"], ["37", "Andhra Pradesh"], ["38", "Ladakh"]];
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var r2 = function (n) { return Math.round((+n + Number.EPSILON) * 100) / 100; };
  var key = function (s) { return String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, ""); };
  var ALIAS = { orissa: "odisha", pondicherry: "puducherry", uttaranchal: "uttarakhand", nctofdelhi: "delhi", newdelhi: "delhi", jk: "jammuandkashmir", up: "uttarpradesh", mp: "madhyapradesh", tn: "tamilnadu", ap: "andhrapradesh", wb: "westbengal", hp: "himachalpradesh" };
  /** A state as typed ("maharashtra", "MH", "27") → [code, name], or null. */
  function stateOf(v) {
    var k = key(v); if (!k && !/\d/.test(String(v || ""))) return null; k = ALIAS[k] || k;
    var num = /^\s*(\d{1,2})\s*$/.exec(String(v || ""));
    for (var i = 0; i < STATES.length; i++) if (key(STATES[i][1]) === k || (num && +num[1] === +STATES[i][0])) return STATES[i];
    return null;
  }
  var money = function (n, cur) { try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: cur || "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n); } catch (e) { return (cur || "INR") + " " + r2(n).toFixed(2); } };
  var num = function (n) { return r2(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  /** 1,23,456.50 → "One lakh twenty-three thousand four hundred fifty-six rupees and fifty paise only". */
  function words(n) {
    var a = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"], b = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
    var two = function (x) { return x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? "-" + a[x % 10] : ""); };
    var three = function (x) { return (x >= 100 ? a[Math.floor(x / 100)] + " hundred" + (x % 100 ? " " : "") : "") + two(x % 100); };
    var whole = Math.floor(r2(n)), paise = Math.round((r2(n) - whole) * 100), out = [];
    var cr = Math.floor(whole / 1e7), lk = Math.floor((whole % 1e7) / 1e5), th = Math.floor((whole % 1e5) / 1e3), rest = whole % 1e3;
    if (cr) out.push(three(cr) + " crore"); if (lk) out.push(two(lk) + " lakh"); if (th) out.push(two(th) + " thousand"); if (rest) out.push(three(rest));
    var s = (out.join(" ") || "zero") + " rupees" + (paise ? " and " + two(paise) + " paise" : "") + " only";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  var rate = function (v, d) { var n = v === "" || v == null ? NaN : +v; return isFinite(n) && n >= 0 && n <= 40 ? n : d; };

  function build(o, C) {
    var G = (C && C.gst) || {}, S = (C && C.settings) || {}, prods = (C && C.products) || [], t = o.t || {};
    var def = rate(G.defaultRate, 18), onTop = !!(+S.taxPercent && !S.taxIncluded && +t.taxAdd);
    var seller = stateOf(G.state), buyer = stateOf((o.c || {}).state || (/^\d{2}[A-Z0-9]{13}$/i.test(String((o.c || {}).gstin || "").trim()) ? String(o.c.gstin).trim().slice(0, 2) : "")), intra = !seller || !buyer || seller[0] === buyer[0];
    var lines = (o.items || []).map(function (it) {
      var p = prods.filter(function (x) { return x.id === it.id; })[0] || {}, gross = r2(it.price * it.qty);
      var r = onTop ? +S.taxPercent : rate(p.gstRate, def), taxable = onTop ? gross : r2(gross / (1 + r / 100)), tax = onTop ? r2(gross * r / 100) : r2(gross - taxable);
      return { name: it.name + (it.opt ? " (" + it.opt + ")" : ""), hsn: String(p.hsn || G.defaultHsn || ""), qty: it.qty, unit: r2(taxable / (it.qty || 1)), taxable: taxable, rate: r, tax: tax };
    });
    if (+t.ship > 0) { var top = t.shipNoTax ? 0 : lines.reduce(function (m, l) { return Math.max(m, l.rate); }, 0), tx = r2(t.ship / (1 + top / 100)); lines.push({ name: t.shipName || "Shipping and handling", hsn: "9968", qty: 1, unit: tx, taxable: tx, rate: top, tax: r2(t.ship - tx), ship: true }); }
    // With tax added on top, the order's own tax figure is the one charged: put any paise of rounding on the last goods line.
    if (onTop) { var goods = lines.filter(function (l) { return !l.ship; }), sum = goods.reduce(function (s, l) { return s + l.tax; }, 0), d = r2(+t.taxAdd - sum); if (d && goods.length) goods[goods.length - 1].tax = r2(goods[goods.length - 1].tax + d); }
    var taxable = r2(lines.reduce(function (s, l) { return s + l.taxable; }, 0)), tax = r2(lines.reduce(function (s, l) { return s + l.tax; }, 0)), total = r2(+t.total || taxable + tax);
    var byRate = {}; lines.forEach(function (l) { var k = l.hsn + "|" + l.rate, x = byRate[k] || (byRate[k] = { hsn: l.hsn, rate: l.rate, taxable: 0, tax: 0 }); x.taxable = r2(x.taxable + l.taxable); x.tax = r2(x.tax + l.tax); });
    return { no: String(G.prefix == null ? "INV-" : G.prefix) + o.id, date: o.at ? new Date(o.at) : new Date(), order: o.id, lines: lines, taxable: taxable, tax: tax, cgst: intra ? r2(tax / 2) : 0, sgst: intra ? r2(tax - r2(tax / 2)) : 0, igst: intra ? 0 : tax,
      roundOff: r2(total - taxable - tax), total: total, intra: intra, seller: seller, buyer: buyer, summary: Object.keys(byRate).map(function (k) { return byRate[k]; }), words: words(total), cur: S.currency || "INR" };
  }

  /* Invoice look (content.invoice): layout, accent colour, font. Returned as CSS added after the page's own. */
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

  function invLogo(I, B) {
    var p = B && B.logo && (B.logo.url || B.logo.path); if (!I || I.logo !== true || !p) return "";
    var u = ""; try { u = new URL(String(p), (window.__invBase || location.href)).href; } catch (e) { return ""; }
    return '<img src="' + esc(u) + '" alt="" style="height:44px;max-width:180px;object-fit:contain;display:block;margin:0 0 8px">';
  }
  function html(o, C, opt) {
    opt = opt || {};
    var G = (C && C.gst) || {}, B = (C && C.brand) || {}, c = o.c || {}, v = build(o, C), cur = v.cur, I = (C && C.invoice) || {};
    var name = G.legalName || B.name || "", th = 'style="text-align:right"';
    var L = function (k, d) { var x = String(I[k] == null ? "" : I[k]).trim(); return esc(x || d); }, K = (C && C.contact) || {}, paper = I.paper === "letter" ? "Letter" : I.paper === "a5" ? "A5" : "A4";
    var showHsn = I.colHsn !== false, showRate = I.colRate !== false, showTaxable = I.colTaxable !== false, showTax = I.colTax !== false;
    var taxCols = v.intra ? "<th " + th + ">CGST</th><th " + th + ">SGST</th>" : "<th " + th + ">IGST</th>";
    var taxCells = function (l) { return v.intra ? "<td " + th + ">" + num(l.tax / 2) + "<br><small>" + l.rate / 2 + "%</small></td><td " + th + ">" + num(l.tax - r2(l.tax / 2)) + "<br><small>" + l.rate / 2 + "%</small></td>" : "<td " + th + ">" + num(l.tax) + "<br><small>" + l.rate + "%</small></td>"; };
    var addr = [c.address, [c.city, c.pin].filter(Boolean).join(" "), c.state].filter(Boolean).map(esc).join("<br>");
    return '<!doctype html>\n<!-- Powered by Picaffectz | https://www.picaffectz.com -->\n<!--\n  Copyright (c) Picaffectz. All rights reserved.\n  This source code is proprietary and confidential. Unauthorized copying or distribution is prohibited.\n-->\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ' + esc(v.no) + "</title><style>" +
      "*{box-sizing:border-box}body{font:13.5px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans',Arial,sans-serif;color:#14171c;margin:0;background:#eef0f3}" +
      ".sheet{max-width:820px;margin:24px auto;background:#fff;padding:36px 40px;box-shadow:0 2px 18px rgba(0,0,0,.12)}h1{font-size:24px;margin:0;letter-spacing:.02em}h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#667;margin:0 0 4px}" +
      ".top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:2px solid #14171c;padding-bottom:16px}.top .r{text-align:right}.two{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:18px 0}" +
      "table{width:100%;border-collapse:collapse;margin-top:6px}th,td{padding:8px 8px;border-bottom:1px solid #dfe3e8;vertical-align:top;text-align:left}th{font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:#556;background:#f5f6f8}small{color:#667}" +
      ".tot{margin-left:auto;width:min(340px,100%);margin-top:14px}.tot div{display:flex;justify-content:space-between;padding:4px 0}.tot .g{font-weight:800;font-size:16px;border-top:2px solid #14171c;margin-top:6px;padding-top:8px}" +
      ".xtra{margin-top:16px;line-height:1.5}.thx{text-align:center;font-weight:700;margin:22px 0 0}.words{margin-top:14px;padding:10px 12px;background:#f5f6f8;border-radius:6px}.foot{display:flex;justify-content:space-between;gap:24px;margin-top:30px;align-items:flex-end}.sign{text-align:right;min-width:200px}.sign i{display:block;height:44px}" +
      ".bar{max-width:820px;margin:16px auto 0;display:flex;gap:10px;justify-content:flex-end;padding:0 4px}.bar button{font:700 14px/1 system-ui,sans-serif;padding:11px 18px;border-radius:8px;border:1px solid #14171c;background:#14171c;color:#fff;cursor:pointer}.bar button.alt{background:#fff;color:#14171c}" +
      "@media print{body{background:#fff}.sheet{box-shadow:none;margin:0;max-width:none;padding:0}.bar{display:none}@page{size:" + paper + ";margin:14mm}}@media (max-width:600px){.sheet{padding:20px 16px;margin:0}.two{grid-template-columns:1fr}.top{flex-direction:column}.top .r{text-align:left}}" +
      invCss(I) + '</style></head><body>' + (opt.bar === false ? '' : '<div class="bar"><button type="button" class="alt" onclick="window.close()">Close</button><button type="button" onclick="window.print()">Print or save as PDF</button></div>') + '<div class="sheet">' +
      '<div class="top"><div>' + invLogo(I, B) + '<h1>' + L("title", G.gstin ? "Tax Invoice" : "Invoice") + "</h1><div><b>" + esc(name) + "</b></div><div>" + esc(G.address || "").replace(/\n/g, "<br>") + "</div>" +
      (G.gstin ? "<div>GSTIN: <b>" + esc(G.gstin) + "</b></div>" : "") + (v.seller ? "<div>State: " + esc(v.seller[1]) + " (" + v.seller[0] + ")</div>" : "") + (G.pan ? "<div>PAN: " + esc(G.pan) + "</div>" : "") + (I.contact === true ? [K.phone, K.email, K.website].filter(Boolean).map(function (x) { return "<div>" + esc(x) + "</div>"; }).join("") : "") + "</div>" +
      '<div class="r"><div>' + L("lblNo", "Invoice no.") + " <b>" + esc(v.no) + "</b></div><div>" + L("lblDate", "Date") + ": <b>" + esc(v.date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })) + "</b></div><div>" + L("lblOrder", "Order") + ": " + esc(v.order) + "</div>" +
      "<div>" + L("lblSupply", "Place of supply") + ": " + esc(v.buyer ? v.buyer[1] + " (" + v.buyer[0] + ")" : c.state || (v.seller ? v.seller[1] + " (" + v.seller[0] + ")" : "")) + "</div></div></div>" +
      '<div class="two"><div><h2>' + L("lblBill", "Billed to") + '</h2><b>' + esc(c.name || "") + "</b><br>" + addr + (c.gstin ? "<br>GSTIN: <b>" + esc(c.gstin) + "</b>" : "") + "</div><div><h2>" + L("lblContact", "Contact") + "</h2>" + [c.phone, c.email].filter(Boolean).map(esc).join("<br>") + "</div></div>" +
      "<table><thead><tr><th>#</th><th>" + L("lblItem", "Item") + "</th>" + (showHsn ? "<th>" + L("lblHsn", "HSN/SAC") + "</th>" : "") + "<th " + th + ">" + L("lblQty", "Qty") + "</th>" + (showRate ? "<th " + th + ">" + L("lblRate", "Rate") + "</th>" : "") + (showTaxable ? "<th " + th + ">" + L("lblTaxable", "Taxable value") + "</th>" : "") + (showTax ? taxCols : "") + "<th " + th + ">" + L("lblAmount", "Amount") + "</th></tr></thead><tbody>" +
      v.lines.map(function (l, i) { return "<tr><td>" + (i + 1) + "</td><td>" + esc(l.name) + "</td>" + (showHsn ? "<td>" + esc(l.hsn || "-") + "</td>" : "") + "<td " + th + ">" + l.qty + "</td>" + (showRate ? "<td " + th + ">" + num(l.unit) + "</td>" : "") + (showTaxable ? "<td " + th + ">" + num(l.taxable) + "</td>" : "") + (showTax ? taxCells(l) : "") + "<td " + th + ">" + num(l.taxable + l.tax) + "</td></tr>"; }).join("") + "</tbody></table>" +
      '<div class="tot">' + (showTaxable ? "<div><span>" + L("lblTaxable", "Taxable value") + "</span><span>" + num(v.taxable) + "</span></div>" : "") + (!showTax ? "" : v.intra ? "<div><span>CGST</span><span>" + num(v.cgst) + "</span></div><div><span>SGST</span><span>" + num(v.sgst) + "</span></div>" : "<div><span>IGST</span><span>" + num(v.igst) + "</span></div>") +
      (v.roundOff ? "<div><span>Round off</span><span>" + num(v.roundOff) + "</span></div>" : "") + '<div class="g"><span>' + L("lblTotal", "Total") + '</span><span>' + esc(money(v.total, cur)) + "</span></div></div>" +
      '<div class="words"><small>' + L("lblWords", "Amount in words") + '</small><br><b>' + esc(v.words) + "</b></div>" +
      "<div class=\"taxsum\"><h2 style=\"margin-top:20px\">" + L("lblSummary", "Tax summary") + "</h2><table><thead><tr><th>HSN/SAC</th><th " + th + ">Rate</th><th " + th + ">Taxable value</th><th " + th + ">Tax</th></tr></thead><tbody>" +
      v.summary.map(function (s) { return "<tr><td>" + esc(s.hsn || "-") + "</td><td " + th + ">" + s.rate + "%</td><td " + th + ">" + num(s.taxable) + "</td><td " + th + ">" + num(s.tax) + "</td></tr>"; }).join("") + "</tbody></table></div>" +
      (I.bank ? '<div class="xtra"><h2>' + L("lblBank", "Bank details") + "</h2>" + esc(I.bank).replace(/\n/g, "<br>") + "</div>" : "") + (I.terms ? '<div class="xtra"><h2>' + L("lblTerms", "Terms & conditions") + "</h2><small>" + esc(I.terms).replace(/\n/g, "<br>") + "</small></div>" : "") + (I.thanks ? '<p class="thx">' + esc(I.thanks) + "</p>" : "") +
      '<div class="foot"><div><small>' + esc(G.notes || "").replace(/\n/g, "<br>") + (G.notes ? "<br>" : "") + L("footer", "This is a computer-generated invoice.") + '</small></div><div class="sign"><small>For ' + esc(name) + "</small><i></i><b>" + esc(G.sign || "Authorised signatory") + "</b></div></div></div></body></html>";
  }
  /** Opens the invoice in a new tab, ready to print or save as PDF. */
  function open(o, C) {
    var page = html(o, C), w = null;
    try { w = window.open("", "_blank"); } catch (e) {}
    if (w && w.document) { w.document.open(); w.document.write(page); w.document.close(); return true; }
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([page], { type: "text/html" })); a.download = "invoice-" + String(o.id).replace(/[^\w-]/g, "") + ".html"; document.body.appendChild(a); a.click(); a.remove(); return false;
  }
  window.SiteInvoice = { build: build, html: html, open: open, STATES: STATES, stateOf: stateOf, words: words };
})();

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
    var seller = stateOf(G.state), buyer = stateOf((o.c || {}).state), intra = !seller || !buyer || seller[0] === buyer[0];
    var lines = (o.items || []).map(function (it) {
      var p = prods.filter(function (x) { return x.id === it.id; })[0] || {}, gross = r2(it.price * it.qty);
      var r = onTop ? +S.taxPercent : rate(p.gstRate, def), taxable = onTop ? gross : r2(gross / (1 + r / 100)), tax = onTop ? r2(gross * r / 100) : r2(gross - taxable);
      return { name: it.name + (it.opt ? " (" + it.opt + ")" : ""), hsn: String(p.hsn || G.defaultHsn || ""), qty: it.qty, unit: r2(taxable / (it.qty || 1)), taxable: taxable, rate: r, tax: tax };
    });
    if (+t.ship > 0) { var top = lines.reduce(function (m, l) { return Math.max(m, l.rate); }, 0), tx = r2(t.ship / (1 + top / 100)); lines.push({ name: "Shipping and handling", hsn: "9968", qty: 1, unit: tx, taxable: tx, rate: top, tax: r2(t.ship - tx), ship: true }); }
    // With tax added on top, the order's own tax figure is the one charged: put any paise of rounding on the last goods line.
    if (onTop) { var goods = lines.filter(function (l) { return !l.ship; }), sum = goods.reduce(function (s, l) { return s + l.tax; }, 0), d = r2(+t.taxAdd - sum); if (d && goods.length) goods[goods.length - 1].tax = r2(goods[goods.length - 1].tax + d); }
    var taxable = r2(lines.reduce(function (s, l) { return s + l.taxable; }, 0)), tax = r2(lines.reduce(function (s, l) { return s + l.tax; }, 0)), total = r2(+t.total || taxable + tax);
    var byRate = {}; lines.forEach(function (l) { var k = l.hsn + "|" + l.rate, x = byRate[k] || (byRate[k] = { hsn: l.hsn, rate: l.rate, taxable: 0, tax: 0 }); x.taxable = r2(x.taxable + l.taxable); x.tax = r2(x.tax + l.tax); });
    return { no: String(G.prefix == null ? "INV-" : G.prefix) + o.id, date: o.at ? new Date(o.at) : new Date(), order: o.id, lines: lines, taxable: taxable, tax: tax, cgst: intra ? r2(tax / 2) : 0, sgst: intra ? r2(tax - r2(tax / 2)) : 0, igst: intra ? 0 : tax,
      roundOff: r2(total - taxable - tax), total: total, intra: intra, seller: seller, buyer: buyer, summary: Object.keys(byRate).map(function (k) { return byRate[k]; }), words: words(total), cur: S.currency || "INR" };
  }

  function html(o, C) {
    var G = (C && C.gst) || {}, B = (C && C.brand) || {}, c = o.c || {}, v = build(o, C), cur = v.cur;
    var name = G.legalName || B.name || "", th = 'style="text-align:right"';
    var taxCols = v.intra ? "<th " + th + ">CGST</th><th " + th + ">SGST</th>" : "<th " + th + ">IGST</th>";
    var taxCells = function (l) { return v.intra ? "<td " + th + ">" + num(l.tax / 2) + "<br><small>" + l.rate / 2 + "%</small></td><td " + th + ">" + num(l.tax - r2(l.tax / 2)) + "<br><small>" + l.rate / 2 + "%</small></td>" : "<td " + th + ">" + num(l.tax) + "<br><small>" + l.rate + "%</small></td>"; };
    var addr = [c.address, [c.city, c.pin].filter(Boolean).join(" "), c.state].filter(Boolean).map(esc).join("<br>");
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ' + esc(v.no) + "</title><style>" +
      "*{box-sizing:border-box}body{font:13.5px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans',Arial,sans-serif;color:#14171c;margin:0;background:#eef0f3}" +
      ".sheet{max-width:820px;margin:24px auto;background:#fff;padding:36px 40px;box-shadow:0 2px 18px rgba(0,0,0,.12)}h1{font-size:24px;margin:0;letter-spacing:.02em}h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#667;margin:0 0 4px}" +
      ".top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:2px solid #14171c;padding-bottom:16px}.top .r{text-align:right}.two{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:18px 0}" +
      "table{width:100%;border-collapse:collapse;margin-top:6px}th,td{padding:8px 8px;border-bottom:1px solid #dfe3e8;vertical-align:top;text-align:left}th{font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:#556;background:#f5f6f8}small{color:#667}" +
      ".tot{margin-left:auto;width:min(340px,100%);margin-top:14px}.tot div{display:flex;justify-content:space-between;padding:4px 0}.tot .g{font-weight:800;font-size:16px;border-top:2px solid #14171c;margin-top:6px;padding-top:8px}" +
      ".words{margin-top:14px;padding:10px 12px;background:#f5f6f8;border-radius:6px}.foot{display:flex;justify-content:space-between;gap:24px;margin-top:30px;align-items:flex-end}.sign{text-align:right;min-width:200px}.sign i{display:block;height:44px}" +
      ".bar{max-width:820px;margin:16px auto 0;display:flex;gap:10px;justify-content:flex-end;padding:0 4px}.bar button{font:700 14px/1 system-ui,sans-serif;padding:11px 18px;border-radius:8px;border:1px solid #14171c;background:#14171c;color:#fff;cursor:pointer}.bar button.alt{background:#fff;color:#14171c}" +
      "@media print{body{background:#fff}.sheet{box-shadow:none;margin:0;max-width:none;padding:0}.bar{display:none}@page{size:A4;margin:14mm}}@media (max-width:600px){.sheet{padding:20px 16px;margin:0}.two{grid-template-columns:1fr}.top{flex-direction:column}.top .r{text-align:left}}" +
      '</style></head><body><div class="bar"><button type="button" class="alt" onclick="window.close()">Close</button><button type="button" onclick="window.print()">Print or save as PDF</button></div><div class="sheet">' +
      '<div class="top"><div><h1>' + (G.gstin ? "Tax Invoice" : "Invoice") + "</h1><div><b>" + esc(name) + "</b></div><div>" + esc(G.address || "").replace(/\n/g, "<br>") + "</div>" +
      (G.gstin ? "<div>GSTIN: <b>" + esc(G.gstin) + "</b></div>" : "") + (v.seller ? "<div>State: " + esc(v.seller[1]) + " (" + v.seller[0] + ")</div>" : "") + (G.pan ? "<div>PAN: " + esc(G.pan) + "</div>" : "") + "</div>" +
      '<div class="r"><div>Invoice no. <b>' + esc(v.no) + "</b></div><div>Date: <b>" + esc(v.date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })) + "</b></div><div>Order: " + esc(v.order) + "</div>" +
      "<div>Place of supply: " + esc(v.buyer ? v.buyer[1] + " (" + v.buyer[0] + ")" : c.state || (v.seller ? v.seller[1] + " (" + v.seller[0] + ")" : "")) + "</div></div></div>" +
      '<div class="two"><div><h2>Billed to</h2><b>' + esc(c.name || "") + "</b><br>" + addr + (c.gstin ? "<br>GSTIN: <b>" + esc(c.gstin) + "</b>" : "") + "</div><div><h2>Contact</h2>" + [c.phone, c.email].filter(Boolean).map(esc).join("<br>") + "</div></div>" +
      "<table><thead><tr><th>#</th><th>Item</th><th>HSN/SAC</th><th " + th + ">Qty</th><th " + th + ">Rate</th><th " + th + ">Taxable value</th>" + taxCols + "<th " + th + ">Amount</th></tr></thead><tbody>" +
      v.lines.map(function (l, i) { return "<tr><td>" + (i + 1) + "</td><td>" + esc(l.name) + "</td><td>" + esc(l.hsn || "-") + "</td><td " + th + ">" + l.qty + "</td><td " + th + ">" + num(l.unit) + "</td><td " + th + ">" + num(l.taxable) + "</td>" + taxCells(l) + "<td " + th + ">" + num(l.taxable + l.tax) + "</td></tr>"; }).join("") + "</tbody></table>" +
      '<div class="tot"><div><span>Taxable value</span><span>' + num(v.taxable) + "</span></div>" + (v.intra ? "<div><span>CGST</span><span>" + num(v.cgst) + "</span></div><div><span>SGST</span><span>" + num(v.sgst) + "</span></div>" : "<div><span>IGST</span><span>" + num(v.igst) + "</span></div>") +
      (v.roundOff ? "<div><span>Round off</span><span>" + num(v.roundOff) + "</span></div>" : "") + '<div class="g"><span>Total</span><span>' + esc(money(v.total, cur)) + "</span></div></div>" +
      '<div class="words"><small>Amount in words</small><br><b>' + esc(v.words) + "</b></div>" +
      "<h2 style=\"margin-top:20px\">Tax summary</h2><table><thead><tr><th>HSN/SAC</th><th " + th + ">Rate</th><th " + th + ">Taxable value</th><th " + th + ">Tax</th></tr></thead><tbody>" +
      v.summary.map(function (s) { return "<tr><td>" + esc(s.hsn || "-") + "</td><td " + th + ">" + s.rate + "%</td><td " + th + ">" + num(s.taxable) + "</td><td " + th + ">" + num(s.tax) + "</td></tr>"; }).join("") + "</tbody></table>" +
      '<div class="foot"><div><small>' + esc(G.notes || "").replace(/\n/g, "<br>") + (G.notes ? "<br>" : "") + 'This is a computer-generated invoice.</small></div><div class="sign"><small>For ' + esc(name) + "</small><i></i><b>" + esc(G.sign || "Authorised signatory") + "</b></div></div></div></body></html>";
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

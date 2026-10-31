(() => {
"use strict";
const $ = id => document.getElementById(id);
const API = "/api/farm-management";
let token = sessionStorage.getItem("kv_farmer_token") || "";
let busy = false;

const esc = v => String(v ?? "").replace(/[&<>"']/g, c =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = v => "₹" + Number(v || 0).toLocaleString("en-IN",{maximumFractionDigits:2});
const fmt = v => Number(v || 0).toLocaleString("en-IN",{maximumFractionDigits:2});
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
function say(text,type="") {
  const el=$("farm-management-status");
  if(el){el.textContent=text;el.className=`message ${type}`.trim();}
}
function formSay(id,text,type="") {
  const el=$(id);if(el){el.textContent=text;el.className=`form-message ${type}`.trim();}
}
async function api(path="",options={}) {
  const r=await fetch(API+path,{...options,headers:{
    "Content-Type":"application/json",
    Authorization:`Bearer ${token}`,...(options.headers||{})
  }});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.message||data.error||`Request failed (${r.status})`);
  return data.data??data;
}
function locked() {
  $("farm-management-content")?.classList.add("hidden");
  $("farm-management-locked")?.classList.remove("hidden");
}
function unlocked() {
  $("farm-management-content")?.classList.remove("hidden");
  $("farm-management-locked")?.classList.add("hidden");
}
function renderSummary(s={}) {
  const metrics=[
    ["Total recorded costs",money(s.total_expenses),"Inputs, irrigation and other expenses"],
    ["Recorded revenue",money(s.recorded_revenue),"Actual revenue only"],
    ["Net profit / loss",money(s.net_profit_on_recorded_revenue),"Recorded revenue minus costs"],
    ["Cost per acre",s.cost_per_acre==null?"Not available":money(s.cost_per_acre),"Requires saved farm size"],
    ["Planned yield",`${fmt(s.planned_yield_kg)} kg`,"Plans not yet harvested"],
    ["Actual harvested",`${fmt(s.actual_yield_kg)} kg`,"Recorded harvest results"],
    ["Water recorded",`${fmt(s.total_water_litres)} L`,"From irrigation logs"],
    ["Input costs",money(s.input_costs),"Input log totals"]
  ];
  $("farm-management-summary").innerHTML=metrics.map(([a,b,c])=>
    `<article class="fm-metric"><span>${esc(a)}</span><strong>${esc(b)}</strong><small>${esc(c)}</small></article>`
  ).join("");
  $("fm-cost-breakdown").innerHTML=[
    ["Input costs",s.input_costs],["Irrigation costs",s.irrigation_costs],
    ["Separate expenses",s.separately_recorded_expenses]
  ].map(([a,b])=>`<div class="fm-breakdown-row"><span>${esc(a)}</span><strong>${money(b)}</strong></div>`).join("");
  $("fm-accounting-note").textContent=s.note||"Only recorded revenue and costs are included.";
}
function renderRecords(id,rows,kind) {
  const empty={inputs:"No inputs recorded yet.",irrigation:"No irrigation records yet.",expenses:"No expenses recorded yet."};
  const html=rows.map(r=>{
    let title,sub,date,cost;
    if(kind==="inputs"){
      title=r.product_name;sub=`${r.input_type} · ${fmt(r.quantity)} ${r.unit} · ${r.target_crop||"Crop unspecified"}`;
      date=r.application_date;cost=r.cost;
    } else if(kind==="irrigation"){
      title=`${r.method} irrigation`;sub=`${r.target_crop||"Crop unspecified"} · ${r.water_litres==null?"Water not recorded":fmt(r.water_litres)+" L"}`;
      date=r.irrigation_date;cost=r.cost;
    } else {
      title=r.description;sub=`${r.category} · ${r.crop_name||"Farm-wide"}`;date=r.expense_date;cost=r.amount;
    }
    return `<article class="fm-record"><div><strong>${esc(title)}</strong><p>${esc(sub)}</p><small>${esc(date)}</small>${r.notes?`<p>${esc(r.notes)}</p>`:""}</div><strong>${money(cost)}</strong></article>`;
  }).join("");
  $(id).innerHTML=html||`<p class="muted">${empty[kind]}</p>`;
}
function renderPlans(rows=[]) {
  $("fm-plan-list").innerHTML=rows.length?rows.map(r=>{
    const id=Number(r.plan_id);
    const active=r.status==="planned";
    return `<article class="fm-plan">
      <div class="fm-plan-heading"><div><strong>${esc(r.crop_name)}${r.variety?" · "+esc(r.variety):""}</strong><p>Expected harvest: ${esc(r.expected_harvest_date)}</p></div><span class="status-badge">${esc(r.status)}</span></div>
      <div class="fm-plan-stats">
        <span>Estimated yield<strong>${fmt(r.estimated_yield_kg)} kg</strong></span>
        <span>Expected price<strong>${money(r.expected_price_per_kg)}/kg</strong></span>
        <span>Estimated gross value<strong>${money(Number(r.estimated_yield_kg||0)*Number(r.expected_price_per_kg||0))}</strong></span>
      </div>
      ${r.status==="harvested"?`<p>Actual yield: <strong>${fmt(r.actual_yield_kg)} kg</strong> · Revenue: <strong>${money(r.actual_revenue)}</strong></p>`:""}
      ${r.notes?`<p>${esc(r.notes)}</p>`:""}
      ${active?`<form class="fm-harvest-form" data-plan="${id}"><h4>Record actual harvest</h4>
        <label>Actual yield (kg)<input name="actual_yield_kg" type="number" min="0.01" step="any" required></label>
        <label>Actual revenue (₹)<input name="actual_revenue" type="number" min="0" step="0.01" required></label>
        <button class="button primary" type="submit">MARK HARVESTED</button><p class="form-message" data-plan-msg="${id}" role="status"></p></form>`:""}
    </article>`;
  }).join(""):'<p class="muted">No harvest plans yet.</p>';
  $("fm-plan-list").querySelectorAll("[data-plan]").forEach(form=>form.addEventListener("submit",async e=>{
    e.preventDefault();const id=form.dataset.plan;const btn=form.querySelector("button");
    const data=new FormData(form);btn.disabled=true;
    try{
      await api(`/plans/${id}`,{method:"PATCH",body:JSON.stringify({
        status:"harvested",actual_yield_kg:Number(data.get("actual_yield_kg")),
        actual_revenue:Number(data.get("actual_revenue"))
      })});
      await load();say("Actual harvest saved.","success");
    }catch(err){formSay(`unused-${id}`,err.message,"error");const msg=form.querySelector("[data-plan-msg]");if(msg)msg.textContent=err.message;btn.disabled=false;}
  }));
}
async function load() {
  token=sessionStorage.getItem("kv_farmer_token")||"";
  if(!token){locked();say("Sign in with a linked farmer account to manage your farm.");return;}
  if(busy)return;busy=true;unlocked();say("Loading farm records…");
  try{
    const d=await api("?limit=100");
    renderSummary(d.summary||{});
    renderRecords("fm-input-list",d.inputs||[],"inputs");
    renderRecords("fm-irrigation-list",d.irrigation||[],"irrigation");
    renderRecords("fm-expense-list",d.expenses||[],"expenses");
    renderPlans(d.plans||[]);
    say("Farm Management updated.","success");
  }catch(e){
    if(/401|login required|token/i.test(e.message))locked();
    say(`Could not load Farm Management: ${e.message}`,"error");
  }finally{busy=false;}
}
async function submit(form,endpoint,messageId,payload) {
  const btn=form.querySelector('[type="submit"]');btn.disabled=true;formSay(messageId,"Saving…");
  try{
    await api(endpoint,{method:"POST",body:JSON.stringify(payload(new FormData(form)))});
    form.reset();
    form.querySelectorAll("[data-default-today]").forEach(x=>x.value=today());
    await load();formSay(messageId,"Saved successfully.","success");
  }catch(e){formSay(messageId,e.message,"error");}
  finally{btn.disabled=false;}
}
function initForms() {
  $("fm-input-form").addEventListener("submit",e=>{
    e.preventDefault();const f=e.currentTarget;
    submit(f,"/inputs","fm-input-message",d=>({
      input_type:d.get("input_type"),product_name:d.get("product_name").trim(),
      quantity:Number(d.get("quantity")),unit:d.get("unit").trim(),
      application_date:d.get("application_date"),target_crop:d.get("target_crop").trim()||null,
      cost:Number(d.get("cost")||0),notes:d.get("notes").trim()||null
    }));
  });
  $("fm-irrigation-form").addEventListener("submit",e=>{
    e.preventDefault();const f=e.currentTarget;
    submit(f,"/irrigation","fm-irrigation-message",d=>({
      irrigation_date:d.get("irrigation_date"),method:d.get("method"),
      duration_minutes:d.get("duration_minutes")===""?null:Number(d.get("duration_minutes")),
      water_litres:d.get("water_litres")===""?null:Number(d.get("water_litres")),
      cost:Number(d.get("cost")||0),target_crop:d.get("target_crop").trim()||null,
      notes:d.get("notes").trim()||null
    }));
  });
  $("fm-expense-form").addEventListener("submit",e=>{
    e.preventDefault();const f=e.currentTarget;
    submit(f,"/expenses","fm-expense-message",d=>({
      expense_date:d.get("expense_date"),category:d.get("category"),
      description:d.get("description").trim(),amount:Number(d.get("amount")),
      crop_name:d.get("crop_name").trim()||null,notes:d.get("notes").trim()||null
    }));
  });
  $("fm-plan-form").addEventListener("submit",e=>{
    e.preventDefault();const f=e.currentTarget;
    submit(f,"/plans","fm-plan-message",d=>({
      crop_name:d.get("crop_name").trim(),variety:d.get("variety").trim()||null,
      planting_date:d.get("planting_date")||null,expected_harvest_date:d.get("expected_harvest_date"),
      estimated_yield_kg:Number(d.get("estimated_yield_kg")),
      expected_price_per_kg:Number(d.get("expected_price_per_kg")||0),notes:d.get("notes").trim()||null
    }));
  });
  $("fm-refresh-button").addEventListener("click",load);
}
function init() {
  if(!$("farm-management-section"))return;
  document.querySelectorAll("[data-default-today]").forEach(x=>x.value=today());
  initForms();load();
  let last=sessionStorage.getItem("kv_farmer_token")||"";
  setInterval(()=>{
    const current=sessionStorage.getItem("kv_farmer_token")||"";
    if(current!==last){last=current;token=current;if(current)load();else{locked();say("Sign in to access your farm records.");}}
  },1000);
  window.addEventListener("focus",()=>{if(sessionStorage.getItem("kv_farmer_token")&&!busy)load();});
}
document.addEventListener("DOMContentLoaded",init);
})();

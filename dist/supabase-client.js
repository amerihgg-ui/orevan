(function(){
  const SESSION_KEY='oravena_auth_session_v1';
  const ACCESS_KEY='oravena_account_access_v1';
  const config=()=>window.ORAVENA_SUPABASE||{};
  const configured=()=>/^https:\/\/.+\.supabase\.co\/?$/.test(config().url||'')&&String(config().anonKey||'').length>40;
  const read=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
  const session=()=>read(SESSION_KEY);
  const headers=(authenticated=true)=>{const h={apikey:config().anonKey,'Content-Type':'application/json'};const token=authenticated&&session()?.access_token;h.Authorization=`Bearer ${token||config().anonKey}`;return h};
  async function request(path,options={}){
    if(!configured())throw new Error('SUPABASE_NOT_CONFIGURED');
    const response=await fetch(config().url.replace(/\/$/,'')+path,{...options,headers:{...headers(options.authenticated!==false),...(options.headers||{})}});
    const body=response.status===204?null:await response.json().catch(()=>null);
    if(!response.ok)throw new Error(body?.msg||body?.message||body?.error_description||'REQUEST_FAILED');
    return body;
  }
  async function signIn(identity,password){
    const field=String(identity).includes('@')?'email':'phone';
    const data=await request('/auth/v1/token?grant_type=password',{method:'POST',authenticated:false,body:JSON.stringify({[field]:String(identity).trim(),password})});
    localStorage.setItem(SESSION_KEY,JSON.stringify(data));
    const access=await request('/rest/v1/rpc/current_account_access',{method:'POST',body:'{}'});
    localStorage.setItem(ACCESS_KEY,JSON.stringify(access));
    return access;
  }
  async function signOut(){
    if(configured()&&session())await request('/auth/v1/logout',{method:'POST'}).catch(()=>{});
    [SESSION_KEY,ACCESS_KEY,'oravenaSessionEmail','oravenaSessionRole'].forEach(k=>localStorage.removeItem(k));
  }
  async function bookAppointment(data){
    return request('/rest/v1/rpc/create_appointment_request',{method:'POST',authenticated:false,body:JSON.stringify({p_full_name:data.name,p_phone:data.phone,p_national_id:data.nationalId||null,p_age:Number(data.age),p_service:data.service})});
  }
  window.OravenaDB={configured,session,access:()=>read(ACCESS_KEY),request,signIn,signOut,bookAppointment};
})();

(function(){
  const SESSION_KEY='oravena_auth_session_v1';
  const ACCESS_KEY='oravena_account_access_v1';
  const config=()=>window.ORAVENA_SUPABASE||{};
  const configured=()=>/^https:\/\/.+\.supabase\.co\/?$/.test(config().url||'')&&String(config().anonKey||'').length>40;
  const read=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
  const session=()=>read(SESSION_KEY);
  const headers=(authenticated=true)=>{const h={apikey:config().anonKey,'Content-Type':'application/json'};const token=authenticated&&session()?.access_token;if(token)h.Authorization=`Bearer ${token}`;return h};
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
    if(!access||access.status!=='active')throw new Error('ACCOUNT_NOT_ACTIVE');
    localStorage.setItem(ACCESS_KEY,JSON.stringify(access));
    return access;
  }
  async function signOut(){
    if(configured()&&session())await request('/auth/v1/logout',{method:'POST'}).catch(()=>{});
    [SESSION_KEY,ACCESS_KEY,'oravenaSessionEmail','oravenaSessionRole','oravenaRole'].forEach(k=>localStorage.removeItem(k));
  }
  async function bookAppointment(data){
    return request('/rest/v1/rpc/create_appointment_request',{method:'POST',authenticated:false,body:JSON.stringify({p_full_name:data.name,p_phone:data.phone,p_national_id:data.nationalId||null,p_age:Number(data.age),p_service:data.service})});
  }
  async function loadCore(){
    const account=read(ACCESS_KEY);
    const [patients,appointments,notifications,staff]=await Promise.all([
      request('/rest/v1/patients?select=*&order=created_at.desc'),
      request('/rest/v1/appointments?select=*,patients(full_name,file_number)&order=created_at.desc'),
      request('/rest/v1/clinic_records?record_type=eq.notification&select=*&order=created_at.desc'),
      account?.account_type==='admin'?request('/rest/v1/staff_invitations?select=*&order=created_at.desc'):Promise.resolve([])
    ]);
    return {
      patients:patients.map(p=>({id:p.id,file:p.file_number,name:p.full_name,phone:p.phone,nationalId:p.national_id||'',age:p.age??'',birth:p.birth_date||'',blood:p.blood_type||'',allergy:p.allergy||'',chronic:p.chronic_conditions||'',meds:p.current_medications||'',doctorNotes:p.doctor_notes||'',contact:p.emergency_contact||'',balance:String(p.balance??0)})),
      appointments:appointments.map(a=>({id:a.id,patientId:a.patient_id,patient:a.patients?.full_name||a.full_name,phone:a.phone,service:a.service,date:a.appointment_date||'',time:a.appointment_time||'',doctor:'غير محدد',status:({new_request:'طلب جديد',confirmed:'مؤكد',changed:'معدل',cancelled:'ملغي',completed:'مكتمل'})[a.status]||a.status,changeReason:a.change_reason||'',createdAt:a.created_at})),
      notifications:notifications.map(n=>({id:n.id,title:n.payload?.title||'إشعار',text:n.payload?.text||'',patientId:n.patient_id,read:Boolean(n.payload?.read)})),
      staff:staff.map(s=>({id:s.id,name:s.full_name,email:s.email,systemRole:s.account_type,role:s.job_title||'',phone:s.phone||'',shift:'',status:({pending:'بانتظار التفعيل',activated:'نشط',suspended:'موقوف'})[s.status]||s.status,permissions:(s.sections||[]).join(','),permissionTemplates:(s.permission_templates||[]).join(',')}))
    };
  }
  async function saveStaffInvitation(data){
    return request('/rest/v1/rpc/upsert_staff_invitation',{method:'POST',body:JSON.stringify({
      p_email:String(data.email||'').trim().toLowerCase(),p_full_name:data.name,
      p_account_type:data.systemRole,p_job_title:data.role||'',p_phone:data.phone||'',
      p_sections:String(data.permissions||'').split(',').filter(Boolean),
      p_permission_templates:String(data.permissionTemplates||'').split(',').filter(Boolean)
    })});
  }
  async function signUpStaff(email,password,fullName){
    return request('/auth/v1/signup',{method:'POST',authenticated:false,body:JSON.stringify({email:String(email).trim().toLowerCase(),password,data:{full_name:fullName||''}})});
  }
  window.OravenaDB={configured,session,access:()=>read(ACCESS_KEY),request,signIn,signOut,bookAppointment,loadCore,saveStaffInvitation,signUpStaff};
})();

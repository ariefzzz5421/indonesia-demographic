/**
 * Visual rhythm pass for /indonesia.
 * Keeps every topic on the same page background, avoids abrupt horizontal
 * color bands, and adds more breathing room between long article sections.
 */
const style = document.createElement('style');
style.textContent = `
  body.page{background-color:var(--ink-0)!important;background-attachment:fixed}
  .page__main{isolation:isolate}
  .page__main > .sect{
    position:relative;
    margin-top:78px!important;
    padding-top:2px;
    background:transparent!important;
  }
  .page__main > .sect + .sect{margin-top:86px!important}
  #sect-presidents{margin-top:82px!important;margin-bottom:92px!important;background:transparent!important}
  #sect-presidents + .sect{margin-top:0!important;padding-top:0}
  #sect-wages{margin-top:92px!important}
  #sect-gen{margin-top:92px!important}
  #sect-presidents .president-grid{margin-top:18px}
  #sect-presidents .president-card,
  .statcard,.card,.tl{
    background-color:color-mix(in srgb,var(--panel) 96%,var(--ink-0) 4%)!important;
  }
  #sect-gen .card--gen{padding:20px 18px 18px}
  #sect-gen .stack{margin-top:16px;margin-bottom:18px}
  #sect-gen .genlist{margin-top:2px}
  @media(max-width:900px){
    .page__main > .sect,.page__main > .sect + .sect{margin-top:64px!important}
    #sect-presidents{margin-top:66px!important;margin-bottom:72px!important}
    #sect-presidents + .sect{margin-top:0!important}
    #sect-wages,#sect-gen{margin-top:72px!important}
  }
  @media(max-width:560px){
    .page__main > .sect,.page__main > .sect + .sect{margin-top:54px!important}
    #sect-presidents{margin-top:56px!important;margin-bottom:62px!important}
    #sect-presidents + .sect{margin-top:0!important}
    #sect-wages,#sect-gen{margin-top:62px!important}
    #sect-gen .card--gen{padding:15px 12px 14px}
  }
`;
document.head.append(style);
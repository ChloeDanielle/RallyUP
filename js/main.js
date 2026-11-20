import './app.js';

// iOS can show the native “Undo Typing” sheet after a shake even when an
// empty field is focused. Empty/uncommitted fields should not participate in
// shake-to-undo, so release focus when motion is detected.
window.addEventListener('devicemotion',()=>{const el=document.activeElement;if(el&&(el.matches('input,textarea')&&!el.value)){el.blur()}},{passive:true});

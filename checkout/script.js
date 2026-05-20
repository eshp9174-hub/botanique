const redirectAfterPayment = "COLOCAR_URL_AQUI";
const URL_PIX_COM_FRETE = "./index.html#pix-com-frete";
const URL_PIX_SEM_FRETE = "./index.html#pix-sem-frete";
const PRODUCT_PRICE = 47.90;
let freteSelecionado = null;

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

function money(value){
  return value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}

function onlyDigits(value){
  return String(value || '').replace(/\D/g,'');
}

function setFieldState(input, state){
  const field = input.closest('.field');
  if(!field) return;
  field.classList.remove('valid','invalid');
  if(state) field.classList.add(state);
}

function focusNext(current){
  const inputs = $$('input:not([readonly])').filter(el => !el.disabled && el.offsetParent !== null);
  const index = inputs.indexOf(current);
  if(index >= 0 && inputs[index + 1]) inputs[index + 1].focus({preventScroll:false});
}

function openStep(step){
  for(let i=1;i<=3;i++){
    const card = $(`#step-${i}`);
    const indicator = $(`[data-step-indicator="${i}"]`);
    if(i <= step){
      card.classList.remove('locked');
      card.classList.add('open');
    }
    if(i < step){
      indicator.classList.remove('active');
      indicator.classList.add('done');
    } else if(i === step){
      indicator.classList.add('active');
      indicator.classList.remove('done');
    } else {
      indicator.classList.remove('active','done');
    }
  }
}

function scrollToStep(step){
  const card = $(`#step-${step}`);
  if(card) card.scrollIntoView({behavior:'smooth',block:'start'});
}

function updateTotals(){
  const selected = $('input[name="shipping"]:checked');
  const freight = selected ? Number(selected.value) : 0;
  const total = PRODUCT_PRICE + freight;
  $('#shippingSummaryLabel').textContent = selected ? selected.dataset.label : 'Frete';
  $('#shippingSummaryValue').textContent = selected ? (freight === 0 ? 'Grátis' : money(freight)) : 'Selecione';
  $('#totalValue').textContent = money(total);
  $('#payNote').textContent = money(total);
}

function validateRequired(input){
  const ok = input.value.trim().length > 1;
  setFieldState(input, ok ? 'valid' : 'invalid');
  return ok;
}

function maskCep(input){
  const digits = onlyDigits(input.value).slice(0,8);
  input.value = digits.length > 5 ? `${digits.slice(0,5)}-${digits.slice(5)}` : digits;
  return digits;
}

function maskPhone(input){
  const d = onlyDigits(input.value).slice(0,11);
  if(d.length <= 2) input.value = d;
  else if(d.length <= 6) input.value = `(${d.slice(0,2)}) ${d.slice(2)}`;
  else if(d.length <= 10) input.value = `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  else input.value = `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  return d;
}

async function lookupCep(cepDigits){
  const cepMessage = $('#cepMessage');
  cepMessage.textContent = 'Buscando endereço...';
  try{
    const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
    const data = await response.json();
    if(data.erro) throw new Error('CEP não encontrado');
    $('#street').value = data.logradouro || '';
    $('#neighborhood').value = data.bairro || '';
    $('#city').value = data.localidade || '';
    $('#state').value = data.uf || '';
    ['street','neighborhood','city','state'].forEach(id => setFieldState($(`#${id}`),'valid'));
    $('#addressFields').hidden = false;
    cepMessage.textContent = 'Endereço encontrado. Informe o número.';
    setFieldState($('#cep'),'valid');
    setTimeout(() => $('#number').focus(), 200);
  }catch(error){
    cepMessage.textContent = 'Não encontramos esse CEP. Confira e tente novamente.';
    setFieldState($('#cep'),'invalid');
  }
}

function maybeShowShipping(){
  const numberOk = $('#number').value.trim().length > 0;
  if(numberOk){
    setFieldState($('#number'),'valid');
    $('#shippingBox').hidden = false;
  } else {
    setFieldState($('#number'),'invalid');
  }
}

function validateCustomerAndOpenPayment(){
  const nameOk = validateRequired($('#firstName'));
  const phoneDigits = onlyDigits($('#phone').value);
  const phoneOk = phoneDigits.length >= 10;
  setFieldState($('#phone'), phoneOk ? 'valid' : 'invalid');
  const email = $('#email');
  if(email.value.trim()){
    setFieldState(email, email.checkValidity() ? 'valid' : 'invalid');
  }
  if(nameOk && phoneOk){
    openStep(3);
  }
}

function startCountdown(){
  let seconds = 9 * 60 + 51;
  const el = $('#countdown');
  setInterval(() => {
    seconds = Math.max(0, seconds - 1);
    const min = String(Math.floor(seconds / 60)).padStart(2,'0');
    const sec = String(seconds % 60).padStart(2,'0');
    el.textContent = `00:${min}:${sec}`;
  }, 1000);
}

function showCheckoutAlert(message){
  const alert = $('#checkoutAlert');
  if(!alert) return;
  alert.textContent = message;
  alert.hidden = false;
  setTimeout(() => {
    alert.hidden = true;
  }, 3500);
}

function renderPixArea(tipo){
  const placeholder = $('#pixPlaceholder');
  if(!placeholder) return;

  const isPago = tipo === 'pago';
  const total = isPago ? money(61.22) : money(47.90);
  const frete = isPago ? money(13.32) : 'Grátis';
  const titulo = isPago ? 'PIX com frete incluso' : 'PIX sem frete';

  placeholder.hidden = false;
  placeholder.innerHTML = `
    <strong>${titulo}</strong>
    <p>Produto: R$ 47,90<br>Frete: ${frete}<br>Total do PIX: <b>${total}</b></p>
    <p>Substitua este bloco pelo HTML, iframe, script, QR Code ou copia e cola do seu gerador de PIX.</p>
  `;
  placeholder.scrollIntoView({behavior:'smooth',block:'center'});
}

function irParaPix(){
  if(freteSelecionado === "pago"){
    window.location.href = URL_PIX_COM_FRETE;
    renderPixArea('pago');
    return;
  }

  if(freteSelecionado === "gratis"){
    window.location.href = URL_PIX_SEM_FRETE;
    renderPixArea('gratis');
    return;
  }

  showCheckoutAlert('Selecione uma opção de frete para continuar');
}

function renderPixFromHash(){
  if(window.location.hash === '#pix-com-frete') renderPixArea('pago');
  if(window.location.hash === '#pix-sem-frete') renderPixArea('gratis');
}

function setupCheckout(){
  const cep = $('#cep');
  const phone = $('#phone');
  const form = $('#checkoutForm');

  cep.addEventListener('input', () => {
    const digits = maskCep(cep);
    setFieldState(cep, digits.length === 8 ? 'valid' : null);
    if(digits.length === 8) lookupCep(digits);
  });

  $('#number').addEventListener('input', maybeShowShipping);
  $('#number').addEventListener('blur', maybeShowShipping);

  $$('input[name="shipping"]').forEach(option => {
    option.addEventListener('change', () => {
      freteSelecionado = option.dataset.tipo === 'pago' ? 'pago' : 'gratis';
      const alert = $('#checkoutAlert');
      if(alert) alert.hidden = true;
      updateTotals();
      openStep(2);
      setTimeout(() => scrollToStep(2), 140);
      setTimeout(() => $('#firstName').focus(), 450);
    });
  });

  $('#firstName').addEventListener('blur', () => validateRequired($('#firstName')));
  $('#firstName').addEventListener('keydown', event => {
    if(event.key === 'Enter') { event.preventDefault(); focusNext($('#firstName')); }
  });

  phone.addEventListener('input', () => {
    const digits = maskPhone(phone);
    setFieldState(phone, digits.length >= 10 ? 'valid' : null);
    validateCustomerAndOpenPayment();
  });

  ['firstName','lastName','email'].forEach(id => {
    $(`#${id}`).addEventListener('input', validateCustomerAndOpenPayment);
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const hasShipping = Boolean($('input[name="shipping"]:checked'));
    const nameOk = validateRequired($('#firstName'));
    const phoneOk = onlyDigits($('#phone').value).length >= 10;
    setFieldState($('#phone'), phoneOk ? 'valid' : 'invalid');

    if(!hasShipping || !freteSelecionado){
      showCheckoutAlert('Selecione uma opção de frete para continuar');
      openStep(1); scrollToStep(1); return;
    }
    if(!nameOk || !phoneOk){
      openStep(2); scrollToStep(2); return;
    }

    window.dispatchEvent(new CustomEvent('pix:generated', {
      detail: {
        product:'Muda de Lichia Precoce',
        quantity:1,
        freteSelecionado,
        total:$('#totalValue').textContent,
        pixUrl: freteSelecionado === 'pago' ? URL_PIX_COM_FRETE : URL_PIX_SEM_FRETE,
        redirectAfterPayment
      }
    }));

    irParaPix();
  });
}

// DELIVERY BANNER
(function(){
  var el=document.getElementById('bf-rota-texto');
  if(!el)return;
  function show(city){
    if(city&&city.length>1){
      el.innerHTML='Entregas amanhã em toda região <span class="bf-city">'+city+'</span>';
    } else {
      el.innerHTML='Entregas amanhã em toda região <span class="bf-city">sua região</span>';
    }
  }
  async function get(){
    var apis=['https://get.geojs.io/v1/ip/geo.json','https://ipwho.is/','https://ipapi.co/json/'];
    for(var i=0;i<apis.length;i++){
      try{var r=await fetch(apis[i]);var d=await r.json();if(d&&d.city){show(d.city);return;}}catch(e){}
    }
    show(null);
  }
  get();
})();

document.addEventListener('DOMContentLoaded', () => {
  startCountdown();
  setupCheckout();
  updateTotals();
  renderPixFromHash();
  window.addEventListener('hashchange', renderPixFromHash);
});

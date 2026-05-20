const BUCKPAY_API_URL = 'https://api.realtechdev.com.br/v1/transactions';
const PIX_AMOUNT_CENTS = 4790;

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function cleanText(value, maxLength = 255) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanDigits(value, maxLength = 20) {
  return String(value || '').replace(/\D/g, '').slice(0, maxLength);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function makeExternalId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `botanique_${Date.now()}_${random}`;
}

function buildTracking(tracking = {}) {
  const allowed = ['ref', 'src', 'sck', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_term', 'utm_content'];
  return allowed.reduce((acc, key) => {
    const value = cleanText(tracking[key] || '', 255);
    acc[key] = value || null;
    return acc;
  }, {});
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, message: 'Método não permitido. Use POST.' });
  }

  const token = process.env.BUCKPAY_SECRET_TOKEN || process.env.BUCKPAY_TOKEN;
  const userAgent = process.env.BUCKPAY_USER_AGENT;

  if (!token) {
    return sendJson(res, 500, { ok: false, message: 'Configuração ausente: BUCKPAY_SECRET_TOKEN.' });
  }

  if (!userAgent) {
    return sendJson(res, 500, { ok: false, message: 'Configuração ausente: BUCKPAY_USER_AGENT. Use o User-Agent fornecido pelo gerente BuckPay.' });
  }

  const body = req.body || {};
  const customer = body.customer || {};
  const delivery = body.delivery || {};

  const payload = {
    external_id: makeExternalId(),
    payment_method: 'pix',
    amount: PIX_AMOUNT_CENTS,
    product: {
      id: 'muda-lichia-precoce',
      name: 'Muda de Lichia Precoce'
    },
    offer: {
      id: 'oferta-pix-4790',
      name: 'Oferta PIX R$ 47,90',
      quantity: 1
    },
    tracking: buildTracking(body.tracking)
  };

  const name = cleanText(customer.name, 100);
  const email = cleanText(customer.email, 100).toLowerCase();
  const phone = cleanDigits(customer.phone, 13);

  if (name.length >= 3 && isValidEmail(email)) {
    payload.buyer = { name, email };
    if (phone.length >= 12) payload.buyer.phone = phone;
  }

  const postbackUrl = process.env.BUCKPAY_POSTBACK_URL;
  if (postbackUrl) payload.postbackUrl = postbackUrl;

  try {
    const response = await fetch(BUCKPAY_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': userAgent,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      const gatewayMessage = responseBody?.error?.message || 'Erro ao criar transação na BuckPay.';
      const gatewayDetail = responseBody?.error?.detail;
      console.error('BuckPay create-pix error', { status: response.status, gatewayMessage, gatewayDetail });
      return sendJson(res, response.status, {
        ok: false,
        message: typeof gatewayDetail === 'string' ? gatewayDetail : gatewayMessage,
        gateway_error: responseBody?.error || responseBody
      });
    }

    const data = responseBody.data || responseBody;
    return sendJson(res, 200, {
      ok: true,
      data: {
        id: data.id,
        status: data.status,
        payment_method: data.payment_method,
        pix: data.pix,
        total_amount: data.total_amount,
        created_at: data.created_at
      }
    });
  } catch (error) {
    console.error('BuckPay create-pix unexpected error', error);
    return sendJson(res, 500, { ok: false, message: 'Erro inesperado ao gerar PIX. Tente novamente.' });
  }
};

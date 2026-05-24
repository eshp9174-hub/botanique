const BLACKCAT_BASE_URL = 'https://api.blackcatpay.com.br/api';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function cleanObject(obj) {
  return Object.fromEntries(
    Object.entries(obj || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido' });
  }

  try {
    const apiKey = process.env.BLACKCAT_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'BLACKCAT_API_KEY não configurada na Vercel'
      });
    }

    const body = req.body || {};
    const amount = Number(body.amount || 0);
    const productPrice = Number(body.productPrice || amount);
    const freight = Number(body.freight || 0);

    const customerName = body.customer?.name;
    const customerPhone = onlyDigits(body.customer?.phone);
    const customerDocument = onlyDigits(body.customer?.document?.number);

    if (!amount || !customerName || !customerPhone || !customerDocument) {
      return res.status(400).json({
        success: false,
        message: 'Dados obrigatórios incompletos: valor, nome, telefone ou CPF'
      });
    }

    const shipping = {
      name: body.shipping?.name || customerName,
      street: body.shipping?.street,
      number: body.shipping?.number,
      complement: body.shipping?.complement,
      neighborhood: body.shipping?.neighborhood,
      city: body.shipping?.city,
      state: body.shipping?.state,
      zipCode: onlyDigits(body.shipping?.zipCode)
    };

    if (!shipping.street || !shipping.number || !shipping.neighborhood || !shipping.city || !shipping.state || !shipping.zipCode) {
      return res.status(400).json({
        success: false,
        message: 'Endereço de entrega incompleto'
      });
    }

    const items = [
      {
        title: body.productTitle || 'Muda de Lichia Precoce',
        unitPrice: productPrice,
        quantity: 1,
        tangible: true
      }
    ];

    if (freight > 0) {
      items.push({
        title: 'Frete prioritário',
        unitPrice: freight,
        quantity: 1,
        tangible: false
      });
    }

    const payload = cleanObject({
      amount,
      currency: 'BRL',
      paymentMethod: 'pix',
      items,
      customer: {
        name: customerName,
        email: body.customer?.email || `cliente${Date.now()}@pedido.local`,
        phone: customerPhone,
        document: {
          number: customerDocument,
          type: body.customer?.document?.type || 'cpf'
        }
      },
      shipping,
      pix: {
        expiresInDays: 1
      },
      postbackUrl: process.env.BLACKCAT_POSTBACK_URL || undefined,
      externalRef: body.externalRef || `ORDER-${Date.now()}`,
      metadata: JSON.stringify({
        freteSelecionado: body.freteSelecionado || null
      }),
      ...(body.utm || {})
    });

    const response = await fetch(`${BLACKCAT_BASE_URL}/sales/create-sale`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return res.status(response.status || 500).json({
        success: false,
        message: 'BlackCat não retornou JSON',
        raw: text.slice(0, 300)
      });
    }

    return res.status(response.status).json(json);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao gerar PIX',
      error: error.message
    });
  }
};

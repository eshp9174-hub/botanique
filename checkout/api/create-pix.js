const BLACKCAT_BASE_URL = 'https://api.blackcatpay.com.br/api';

function cleanObject(obj) {
  return Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido' });
  }

  try {
    const apiKey = process.env.BLACKCAT_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'BLACKCAT_API_KEY não configurada na Vercel' });
    }

    const body = req.body || {};
    const amount = Number(body.amount || 0);
    const productPrice = Number(body.productPrice || amount);
    const freight = Number(body.freight || 0);

    if (!amount || !body.customer?.name || !body.customer?.phone || !body.customer?.document?.number) {
      return res.status(400).json({ success: false, message: 'Dados obrigatórios incompletos' });
    }

    const items = [
      {
        title: body.productTitle || 'Produto',
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
        name: body.customer.name,
        email: body.customer.email || `cliente${Date.now()}@pedido.local`,
        phone: String(body.customer.phone || '').replace(/\D/g, ''),
        document: {
          number: String(body.customer.document.number || '').replace(/\D/g, ''),
          type: body.customer.document.type || 'cpf'
        }
      },
      shipping: {
        name: body.shipping?.name || body.customer.name,
        street: body.shipping?.street,
        number: body.shipping?.number,
        complement: body.shipping?.complement,
        neighborhood: body.shipping?.neighborhood,
        city: body.shipping?.city,
        state: body.shipping?.state,
        zipCode: String(body.shipping?.zipCode || '').replace(/\D/g, '')
      },
      pix: { expiresInDays: 1 },
      postbackUrl: process.env.BLACKCAT_POSTBACK_URL || undefined,
      externalRef: body.externalRef || `ORDER-${Date.now()}`,
      metadata: JSON.stringify({ freteSelecionado: body.freteSelecionado || null }),
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

    const json = await response.json().catch(() => ({}));
    return res.status(response.status).json(json);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro interno ao gerar PIX', error: error.message });
  }
};

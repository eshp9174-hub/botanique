const BLACKCAT_BASE_URL = 'https://api.blackcatpay.com.br/api';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido'
    });
  }

  try {
    const apiKey = process.env.BLACKCAT_API_KEY;
    const transactionId = req.query.transactionId;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'BLACKCAT_API_KEY não configurada na Vercel'
      });
    }

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'transactionId obrigatório'
      });
    }

    const response = await fetch(
      `${BLACKCAT_BASE_URL}/sales/${encodeURIComponent(transactionId)}/status`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey
        }
      }
    );

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

    return res.status(200).json({
      success: true,
      status: json.data?.status || null,
      data: json.data || null
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao consultar status',
      error: error.message
    });
  }
};

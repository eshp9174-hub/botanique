const BLACKCAT_BASE_URL = 'https://api.blackcatpay.com.br/api';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Método não permitido' });
  }

  try {
    const apiKey = process.env.BLACKCAT_API_KEY;
    const transactionId = req.query.transactionId;

    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'BLACKCAT_API_KEY não configurada na Vercel' });
    }
    if (!transactionId) {
      return res.status(400).json({ success: false, message: 'transactionId obrigatório' });
    }

    const response = await fetch(`${BLACKCAT_BASE_URL}/sales/${encodeURIComponent(transactionId)}/status`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey }
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json(json);

    return res.status(200).json({
      success: true,
      status: json.data?.status,
      data: json.data
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro interno ao consultar status', error: error.message });
  }
};

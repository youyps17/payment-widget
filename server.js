require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/process-payment', async (req, res) => {
    try {
        const { firstName, lastName, phone, email, city, line1, line2, amount, clientId } = req.body;

        const authResponse = await axios.post(process.env.AUTH_API_URL, {
            login: process.env.AUTH_LOGIN,
            password: process.env.AUTH_PASSWORD
        }, {
            headers: { 'Accept': 'application/json', 'Accept-Charset': 'UTF-8', 'Content-Type': 'application/json' }
        });

        const accessToken = authResponse.data.access_token; 
        if (!accessToken) throw new Error('Не удалось получить access_token');

        const paymentPayload = {
            amount: parseFloat(amount),
            currency: "AUD",
            country: "EN",
            invoiceId: uuidv4(),
            clientId: clientId,
            bankId: process.env.BANK_ID,
            type: "payid",
            lang: "EN",
            backUrl: process.env.BACK_URL,
            clientCredentials: {
                firstName, lastName, phone, email,
                address: { city, line1, line2: line2 || "" }
            }
        };

        const paymentResponse = await axios.post(process.env.PAYMENT_API_URL, paymentPayload, {
            headers: {
                'Accept': 'application/json',
                'Accept-Charset': 'UTF-8',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const redirectUrl = paymentResponse.data.redirectUrl || paymentResponse.data.url; 
        res.json({ success: true, redirectUrl });

    } catch (error) {
        console.error('Ошибка платежа:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: 'Ошибка при обработке платежа' });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));

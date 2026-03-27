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
        // Данные, которые пришли от клиента из формы виджета
        const { firstName, lastName, phone, email, city, line1, line2, amount, clientId } = req.body;

        // --- ШАГ 1: ПОЛУЧЕНИЕ ТОКЕНА ---
        // Отправляем ТОЛЬКО account_id и public_key (из настроек Render)
        const authResponse = await axios.post(process.env.AUTH_API_URL, {
            account_id: process.env.AUTH_LOGIN,
            public_key: process.env.AUTH_PASSWORD
        }, {
            headers: { 
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        const accessToken = authResponse.data.access_token;
        if (!accessToken) {
            console.error('Ошибка: Токен не получен', authResponse.data);
            return res.status(401).json({ success: false, message: 'Auth failed' });
        }

        // --- ШАГ 2: СОЗДАНИЕ СДЕЛКИ (ОПЛАТА) ---
        // Формируем чистый объект, где нет лишних данных из первого запроса
        const paymentPayload = {
            amount: parseFloat(amount),
            currency: "AUD",
            country: "EN",
            invoiceId: uuidv4(), // Генерация нового ID
            clientId: clientId,  // Тот, что привязан к email
            bankId: process.env.BANK_ID,
            type: "payid",
            lang: "EN",
            backUrl: process.env.BACK_URL,
            clientCredentials: {
                firstName: firstName,
                lastName: lastName,
                phone: phone,
                email: email,
                address: {
                    city: city,
                    line1: line1,
                    line2: line2 || ""
                }
            }
        };

        // Отправляем второй запрос на PAYMENT_API_URL с Bearer токеном
        const paymentResponse = await axios.post(process.env.PAYMENT_API_URL, paymentPayload, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}` // Используем полученный токен
            }
        });

        // Получаем ссылку на оплату из ответа (проверь название поля в доке!)
        const redirectUrl = paymentResponse.data.redirectUrl || paymentResponse.data.url;

        if (redirectUrl) {
            res.json({ success: true, redirectUrl: redirectUrl });
        } else {
            console.error('Ошибка: Ссылка на оплату не найдена в ответе', paymentResponse.data);
            throw new Error('No redirect URL');
        }

    } catch (error) {
        // Вывод подробной ошибки в логи Render для диагностики
        console.error('--- ОШИБКА ПРИ ОБРАБОТКЕ ---');
        if (error.response) {
            console.error('Статус:', error.response.status);
            console.error('Данные от API:', JSON.stringify(error.response.data));
        } else {
            console.error('Сообщение:', error.message);
        }
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

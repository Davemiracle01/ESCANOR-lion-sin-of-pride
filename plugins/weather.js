const axios = require('axios');

module.exports = async function (sock, chatId, city) {
    try {
        if (!city) {
            return await sock.sendMessage(chatId, { text: '🌍 Please specify a city. Example: *.weather London*' });
        }

        const apiKey = '4902c0f2550f58298ad4146a92b65e10';  // Replace with your OpenWeatherMap API key
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

        const response = await axios.get(url);
        const data = response.data;

        const weatherText = `🌦️ *Weather in ${data.name}*\n\n` +
            `🌡️ Temp: *${data.main.temp}°C*\n` +
            `🤒 Feels Like: *${data.main.feels_like}°C*\n` +
            `💧 Humidity: *${data.main.humidity}%*\n` +
            `🌬️ Wind: *${data.wind.speed} m/s*\n` +
            `☁️ Condition: *${data.weather[0].description}*`;

        await sock.sendMessage(chatId, { text: weatherText });

    } catch (error) {
        console.error('🌩️ Error fetching weather:', error.message || error);
        await sock.sendMessage(chatId, { text: '⚠️ Could not fetch weather. Please make sure the city name is correct.' });
    }
};

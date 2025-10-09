#!/usr/bin/env node

const http = require('http');

const API_KEY = 'your-secret-api-key';
const BASE_URL = 'http://localhost:3000';

// Test data that matches the Android app's payload format
const testNotification = {
    deviceId: "test-device-123",
    packageName: "id.dana",
    appName: "DANA",
    postedAt: new Date().toISOString(),
    title: "Payment received",
    text: "Anda menerima Rp 100.000",
    subText: "",
    bigText: "Anda menerima pembayaran sebesar Rp 100.000 dari John Doe",
    channelId: "payment_channel",
    notificationId: 12345,
    amountDetected: "100000",
    extras: {
        "android.title": "Payment received",
        "android.text": "Anda menerima Rp 100.000"
    }
};

function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            }
        };

        if (data) {
            const postData = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const req = http.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve({ statusCode: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data: responseData });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Testing Notification Listener Backend...\n');

    try {
        // Test 1: Health check
        console.log('1. Testing health check...');
        const health = await makeRequest('GET', '/health');
        console.log(`   Status: ${health.statusCode}`);
        console.log(`   Response: ${JSON.stringify(health.data, null, 2)}\n`);

        // Test 2: Test endpoint
        console.log('2. Testing test endpoint...');
        const test = await makeRequest('POST', '/test', { message: 'Test from script' });
        console.log(`   Status: ${test.statusCode}`);
        console.log(`   Response: ${JSON.stringify(test.data, null, 2)}\n`);

        // Test 3: Send notification
        console.log('3. Testing notification webhook...');
        const notification = await makeRequest('POST', '/webhook', testNotification);
        console.log(`   Status: ${notification.statusCode}`);
        console.log(`   Response: ${JSON.stringify(notification.data, null, 2)}\n`);

        // Test 4: Get notifications
        console.log('4. Testing get notifications...');
        const notifications = await makeRequest('GET', '/notifications?limit=5');
        console.log(`   Status: ${notifications.statusCode}`);
        console.log(`   Found ${notifications.data.data?.length || 0} notifications\n`);

        // Test 5: Get devices
        console.log('5. Testing get devices...');
        const devices = await makeRequest('GET', '/devices');
        console.log(`   Status: ${devices.statusCode}`);
        console.log(`   Found ${devices.data.data?.length || 0} devices\n`);

        // Test 6: Get statistics
        console.log('6. Testing statistics...');
        const stats = await makeRequest('GET', '/stats');
        console.log(`   Status: ${stats.statusCode}`);
        console.log(`   Stats: ${JSON.stringify(stats.data.data, null, 2)}\n`);

        console.log('✅ All tests completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n💡 Make sure the server is running: npm run dev');
    }
}

// Check if server is running
console.log('🔍 Checking if server is running on http://localhost:3000...\n');
runTests();
# Webinar Platform - Local Network Setup

## Network Access Information

Your webinar platform is now configured to run on your local network!

### Access URLs:
- **Main Application**: http://192.168.1.43:3000
- **Backend API**: http://192.168.1.43:4000
- **Local Access**: http://localhost:3000

### Quick Start:

1. **Double-click** the `start-network-webinar.bat` file
2. Wait for both backend and frontend servers to start
3. Share the network URL with your HR manager: `http://192.168.1.43:3000`

### Test Webinar Setup:

1. Go to http://localhost:3000/admin (or http://192.168.1.43:3000/admin)
2. Create a test webinar
3. Set a future date/time for testing
4. Your HR manager can access the webinar at the scheduled time

### Important Notes:

- Both you and your HR manager must be on the same local network (WiFi/Ethernet)
- Make sure Windows Firewall allows Node.js through port 3000 and 4000
- The application will automatically handle real-time communication between participants

### Troubleshooting:

If your HR manager can't access the webinar:
1. Check that both devices are on the same network
2. Verify Windows Firewall settings
3. Try temporarily disabling firewall to test
4. Ensure the .bat file is running and both servers are active

### Default Admin Credentials:
- Email: admin@webinar.com
- Password: admin123

You can now host your test webinar!
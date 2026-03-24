import { Stack } from 'expo-router';
import { LogBox } from 'react-native';
import FullScreenAlert from '../components/FullScreenAlert';
import { MedicineProvider } from '../context/MedicineContext';
import { ToastProvider } from '../context/ToastContext';
import PermissionCheckModal from '../components/PermissionCheckModal';
import '../utils/ReminderEngine'; 

LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);

export default function RootLayout() {
  return (
    <ToastProvider>
      <MedicineProvider>
        <>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="auth/login" options={{ title: 'Login', headerBackTitle: 'Back' }} />
            <Stack.Screen name="auth/register" options={{ title: 'Register', headerBackTitle: 'Back' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="alarm" options={{ presentation: 'fullScreenModal', headerShown: false }} />
            <Stack.Screen name="adherence-dashboard" options={{ headerShown: false }} />
          </Stack>
          <FullScreenAlert />
          <PermissionCheckModal />
        </>
      </MedicineProvider>
    </ToastProvider>
  );
}

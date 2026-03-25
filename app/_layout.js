import { Stack } from 'expo-router';
import { LogBox, AppRegistry } from 'react-native';
import FullScreenAlert from '../components/FullScreenAlert';
import { MedicineProvider } from '../context/MedicineContext';
import { ToastProvider } from '../context/ToastContext';
import PermissionCheckModal from '../components/PermissionCheckModal';
import AlarmScreen from '../components/AlarmScreen';
import '../utils/ReminderEngine'; 

LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);

// Register AlarmScreen for the native AlarmActivity to find it.
AppRegistry.registerComponent('AlarmScreen', () => AlarmScreen);

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

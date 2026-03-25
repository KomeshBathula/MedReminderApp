import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import notifee, { AndroidImportance, AndroidVisibility, TriggerType, RepeatFrequency } from '@notifee/react-native';

// Configure Notifee for Android
const setupNotifee = async () => {
    if (Platform.OS !== 'android') return;
    
    await notifee.createChannel({
        id: 'alarm',
        name: 'Medication Alarms',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'default',
        vibration: true,
        lights: true,
    });
};

setupNotifee();

export const FREQUENCY_TIMES = {
    "Once daily": ["09:00"],
    "Twice daily": ["09:00", "21:00"],
    "Three times daily": ["09:00", "14:00", "21:00"],
};

/**
 * Normalizes frequency string to match FREQUENCY_TIMES keys
 */
export const normalizeFrequency = (freq) => {
    const f = freq?.toLowerCase() || "";
    if (f.includes("once") || f === "1" || f.includes("1 time")) return "Once daily";
    if (f.includes("twice") || f === "2" || f.includes("2 times")) return "Twice daily";
    if (f.includes("three") || f === "3" || f.includes("3 times")) return "Three times daily";
    return "Once daily"; // Default
};

export const scheduleMedicineReminders = async (medicine, lang = 'en') => {
    if (Platform.OS !== 'android') return [];

    let times = medicine.times;
    if (!times || times.length === 0) {
        const frequency = normalizeFrequency(medicine.frequency);
        times = FREQUENCY_TIMES[frequency] || ["09:00"];
    }

    const notificationIds = [];
    for (const time of times) {
        const [hours, minutes] = time.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        if (date <= new Date()) date.setDate(date.getDate() + 1);

        try {
            const slotKey = `${medicine.id}_${time}`;
            const trigger = { 
                type: TriggerType.TIMESTAMP, 
                timestamp: date.getTime(), 
                repeatFrequency: RepeatFrequency.DAILY,
                alarmManager: true // Enable exact alarms if possible
            }; 
            const id = await notifee.createTriggerNotification({
                title: 'Medicine Reminder',
                body: `Time to take your medicine ${medicine.name}`,
                data: { medicineId: medicine.id, medicineName: medicine.name, slotKey, lang },
                android: {
                    channelId: 'alarm',
                    importance: AndroidImportance.HIGH,
                    visibility: AndroidVisibility.PUBLIC,
                    category: 'alarm',
                    fullScreenAction: {
                        id: 'default',
                        launchActivity: 'com.team01.MedReminderApp.AlarmActivity',
                    },
                    pressAction: {
                        id: 'default',
                        launchActivity: 'com.team01.MedReminderApp.AlarmActivity',
                    },
                },
            }, trigger);
            notificationIds.push(id);
        } catch (error) {
            console.error(`Failed to schedule with Notifee for ${medicine.name}:`, error);
        }
    }
    return notificationIds;
};

export const cancelMedicineReminders = async (notificationIds) => {
    if (Platform.OS !== 'android') return;
    if (!notificationIds || notificationIds.length === 0) return;
    for (const id of notificationIds) {
        try { await notifee.cancelNotification(id); } catch (e) { }
    }
};

export const scheduleAdhocNotification = async (medicine, delayMinutes, lang = 'en') => {
    if (Platform.OS !== 'android') return null;
    const date = new Date();
    date.setMinutes(date.getMinutes() + delayMinutes);

    const trigger = { 
        type: TriggerType.TIMESTAMP, 
        timestamp: date.getTime(),
        alarmManager: true // One-off high priority alarm
    };
    const id = await notifee.createTriggerNotification({
        title: 'Medicine Reminder (Follow-up)',
        body: `Time to take your ${medicine.name} - you postponed this earlier.`,
        data: { 
            medicineId: medicine.id, 
            medicineName: medicine.name, 
            slotKey: medicine.slotKey || medicine._slotKey || medicine.id,
            lang
        },
        android: {
            channelId: 'alarm',
            importance: AndroidImportance.HIGH,
            fullScreenAction: {
                id: 'default',
                launchActivity: 'com.team01.MedReminderApp.AlarmActivity',
            },
            pressAction: {
                id: 'default',
                launchActivity: 'com.team01.MedReminderApp.AlarmActivity',
            },
        },
    }, trigger);
    return id;
};

/**
 * Speaks the reminder message in the specified language
 */
export const speakReminder = (medicineName, lang = 'en') => {
    // Speech not supported on web
    if (Platform.OS === 'web') return;

    if (lang === 'te') {
        // Telugu Reminder
        // Translation: "It's time for your medicine. Please take [Medicine Name]."
        const teluguMessage = `మీ మందు వేసుకునే సమయం అయింది. దయచేసి ${medicineName} వేసుకోండి.`;
        Speech.speak(teluguMessage, {
            language: 'te-IN',
            pitch: 1.0,
            rate: 0.8, // Slightly slower for clarity
        });
    } else {
        // English Reminder
        Speech.speak(`Time to take your medicine ${medicineName}`, {
            language: 'en',
            pitch: 1.0,
            rate: 0.9,
        });
    }
};

export const stopSpeaking = () => {
    Speech.stop();
};

/**
 * Request notification permissions
 */
export const requestPermissions = async () => {
    if (Platform.OS === 'web') return true; // No permission needed on web
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    return finalStatus === 'granted';
};

// Handle background events
notifee.onBackgroundEvent(async ({ type, detail }) => {
    const { notification } = detail;
    if (notification?.data?.medicineId) {
        // Essential to ensure the activity is aware of the alarm even in background
    }
});

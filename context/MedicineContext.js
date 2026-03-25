import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    scheduleMedicineReminders,
    cancelMedicineReminders,
    requestPermissions,
    stopSpeaking
} from '../utils/ReminderEngine';
import notifee, { EventType } from '@notifee/react-native';
import { BACKEND_URL } from '../constants/api';

const MedicineContext = createContext();

export const MedicineProvider = ({ children }) => {
    const [prescriptions, setPrescriptions] = useState([]);
    const [adherenceLogs, setAdherenceLogs] = useState([]);
    const [userData, setUserData] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [activeAlert, setActiveAlert] = useState(null);
    const [preferredLanguage, setPreferredLanguage] = useState('en');
    const [skipCounts, setSkipCounts] = useState({});
    const [snoozeCounts, setSnoozeCounts] = useState({});
    const [ignoredCounts, setIgnoredCounts] = useState({});

    const closeAlert = async () => {
        stopSpeaking();
        setActiveAlert(null);
        await AsyncStorage.removeItem('pending_alarm');
    };

    const clearAllData = async () => {
        try {
            await AsyncStorage.multiRemove([
                'prescriptions', 'adherenceLogs', 'skipCounts', 'snoozeCounts',
                'ignoredCounts', 'user', 'preferredLanguage', 'pending_alarm'
            ]);
            setUserData(null);
            setPrescriptions([]);
            setAdherenceLogs([]);
            setSkipCounts({});
            setSnoozeCounts({});
            setIgnoredCounts({});
            setActiveAlert(null);
        } catch (e) { console.error(e); }
    };

    const initialize = async () => {
        await requestPermissions();

        // Cold start detection
        const initial = await notifee.getInitialNotification();
        if (initial?.notification?.data?.medicineId) {
            const data = initial.notification.data;
            await AsyncStorage.setItem('pending_alarm', JSON.stringify({
                medicineId: data.medicineId,
                slotKey: data.slotKey || data.medicineId,
                lang: data.lang || 'en'
            }));
        }

        const medicines = await loadData();
        await checkPendingAlarm(medicines);
        setIsInitialized(true);
    };

    useEffect(() => {
        initialize();
    }, []);

    const loadData = async () => {
        try {
            const [storedMeds, storedLogs, storedUser, storedLang, storedSkips, storedSnoozes, storedIgnored] = await Promise.all([
                AsyncStorage.getItem('prescriptions'),
                AsyncStorage.getItem('adherenceLogs'),
                AsyncStorage.getItem('user'),
                AsyncStorage.getItem('preferredLanguage'),
                AsyncStorage.getItem('skipCounts'),
                AsyncStorage.getItem('snoozeCounts'),
                AsyncStorage.getItem('ignoredCounts'),
            ]);

            const medicines = storedMeds ? JSON.parse(storedMeds) : [];
            setPrescriptions(medicines);
            setAdherenceLogs(storedLogs ? JSON.parse(storedLogs) : []);
            if (storedUser) setUserData(JSON.parse(storedUser));
            if (storedLang) setPreferredLanguage(storedLang);
            if (storedSkips) setSkipCounts(JSON.parse(storedSkips));
            if (storedSnoozes) setSnoozeCounts(JSON.parse(storedSnoozes));
            if (storedIgnored) setIgnoredCounts(JSON.parse(storedIgnored));

            return medicines;
        } catch (e) { return []; }
    };

    const checkPendingAlarm = async (providedMeds) => {
        try {
            const pendingStr = await AsyncStorage.getItem('pending_alarm');
            if (pendingStr) {
                const pending = JSON.parse(pendingStr);
                const medsList = providedMeds || prescriptions;
                let med = null;
                for (const p of medsList) {
                    med = (p.medicines || []).find(m => String(m.id) === String(pending.medicineId));
                    if (med) break;
                }

                if (med) {
                    setActiveAlert({ ...med, _slotKey: pending.slotKey, lang: pending.lang });
                    return true;
                }
            }
        } catch (e) { }
        return false;
    };

    const logAdherence = async (medicineId, status, slotKey) => {
        const today = new Date().toISOString().split('T')[0];
        const existingIndex = adherenceLogs.findIndex(log => 
            log.slotKey === (slotKey || medicineId) && 
            log.timestamp.startsWith(today)
        );

        let updatedLogs;
        if (existingIndex !== -1) {
            // Update existing log for this slot today
            updatedLogs = [...adherenceLogs];
            updatedLogs[existingIndex] = {
                ...updatedLogs[existingIndex],
                status,
                timestamp: new Date().toISOString()
            };
        } else {
            // Add new log
            const newLog = {
                id: Date.now().toString(),
                medicineId,
                slotKey: slotKey || medicineId,
                status,
                timestamp: new Date().toISOString(),
            };
            updatedLogs = [newLog, ...adherenceLogs];
        }

        setAdherenceLogs(updatedLogs);
        await AsyncStorage.setItem('adherenceLogs', JSON.stringify(updatedLogs));
        if (status === 'taken') updateSkipCount(medicineId, 'reset');
    };

    const updateSkipCount = (medicineId, action) => {
        const updated = { ...skipCounts };
        const newVal = action === 'increment' ? (updated[medicineId] || 0) + 1 : 0;
        updated[medicineId] = newVal;
        setSkipCounts(updated);
        AsyncStorage.setItem('skipCounts', JSON.stringify(updated));
        return newVal;
    };

    const updateSnoozeCount = (medicineId, action) => {
        const updated = { ...snoozeCounts };
        const newVal = action === 'increment' ? (updated[medicineId] || 0) + 1 : 0;
        updated[medicineId] = newVal;
        setSnoozeCounts(updated);
        AsyncStorage.setItem('snoozeCounts', JSON.stringify(updated));
        return newVal;
    };

    const updateIgnoredCount = (medicineId, action) => {
        const updated = { ...ignoredCounts };
        const newVal = action === 'increment' ? (updated[medicineId] || 0) + 1 : 0;
        updated[medicineId] = newVal;
        setIgnoredCounts(updated);
        AsyncStorage.setItem('ignoredCounts', JSON.stringify(updated));
        return newVal;
    };

    const triggerEscalation = async (medicineName) => {
        if (userData?.caretakerEmail && userData?.email) {
            try {
                await fetch(`${BACKEND_URL}/send-alert`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userEmail: userData.email,
                        caretakerEmail: userData.caretakerEmail,
                        medicineName: medicineName
                    })
                });
            } catch (e) { }
        }
    };

    const addPrescription = async (p) => {
        try {
            const updated = [...prescriptions, p];
            setPrescriptions(updated);
            await AsyncStorage.setItem('prescriptions', JSON.stringify(updated));
            for (const med of (p.medicines || [])) {
                await scheduleMedicineReminders(med, preferredLanguage);
            }
            return true;
        } catch (e) { return false; }
    };

    const deletePrescription = async (id) => {
        try {
            const updated = prescriptions.filter(p => p.id !== id);
            setPrescriptions(updated);
            await AsyncStorage.setItem('prescriptions', JSON.stringify(updated));
            return true;
        } catch (e) { return false; }
    };

    useEffect(() => {
        const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
            if (activeAlert) return; // Prevent duplicate/stacking alerts

            if (type === EventType.DELIVERED || type === EventType.PRESS) {
                const data = detail.notification?.data;
                if (data?.medicineId) {
                    await AsyncStorage.setItem('pending_alarm', JSON.stringify({ 
                        medicineId: data.medicineId, 
                        slotKey: data.slotKey || data.medicineId,
                        lang: data.lang || 'en'
                    }));
                }
                await checkPendingAlarm();
            }
        });
        return () => unsubscribe();
    }, [prescriptions, activeAlert]);

    return (
        <MedicineContext.Provider value={{
            prescriptions, adherenceLogs, userData, setUserData, isInitialized,
            addPrescription, deletePrescription, logAdherence,
            skipCounts, updateSkipCount, snoozeCounts, updateSnoozeCount,
            ignoredCounts, updateIgnoredCount, triggerEscalation,
            activeAlert, closeAlert, clearAllData,
            preferredLanguage, setPreferredLanguage,
        }}>
            {children}
        </MedicineContext.Provider>
    );
};

export const useMedicines = () => useContext(MedicineContext);

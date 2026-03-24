import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMedicines } from '../context/MedicineContext';
import { colors, spacing, radius, shadow } from '../constants/theme';
import { speakReminder, stopSpeaking } from '../utils/ReminderEngine';
import notifee from '@notifee/react-native';

export default function FullScreenAlert() {
    const {
        activeAlert, closeAlert, logAdherence, updateSkipCount, updateSnoozeCount, updateIgnoredCount,
        triggerEscalation, preferredLanguage
    } = useMedicines();
    
    const inactivityTimer = useRef(null);
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    
    // Voice control persistence
    const lastSpokenName = useRef(null);
    const voiceInterval = useRef(null);

    const currentLang = activeAlert?.lang || preferredLanguage || 'en';

    const t = {
        en: {
            title: "Medicine Reminder",
            alarm: "Voice Alarm Active...",
            taken: "I've Taken It",
            snooze: "10m Snooze",
            skip: "Skip Dose",
            dismiss: "Dismiss Alarm",
            scheduled: "Scheduled for"
        },
        te: {
            title: "మందుల రిమైండర్",
            alarm: "వాయిస్ అలారం ప్లే అవుతోంది...",
            taken: "నేను వేసుకున్నాను",
            snooze: "10ని||ల తర్వాత",
            skip: "వద్దు (Skip)",
            dismiss: "అలారం ఆపివేయి",
            scheduled: "సమయం:"
        }
    }[currentLang] || { title: "Medicine Reminder", alarm: "Voice Alarm Active...", taken: "Taken", snooze: "Snooze", skip: "Skip", dismiss: "Dismiss" };

    useEffect(() => {
        if (activeAlert) {
            if (lastSpokenName.current !== activeAlert.name) {
                lastSpokenName.current = activeAlert.name;
                setTimeout(() => startVoiceLoop(), 200);
            }

            if (!inactivityTimer.current) {
                inactivityTimer.current = setTimeout(async () => {
                    closeAlert();
                }, 5 * 60 * 1000);
            }

            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
        } else {
            stopVoiceLoop();
            lastSpokenName.current = null;
            if (inactivityTimer.current) { clearTimeout(inactivityTimer.current); inactivityTimer.current = null; }
            scaleAnim.setValue(0.9);
        }

        return () => {
            stopVoiceLoop();
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        };
    }, [activeAlert]);

    const startVoiceLoop = () => {
        if (!activeAlert) return;
        if (voiceInterval.current) clearInterval(voiceInterval.current);

        const play = () => {
            if (!lastSpokenName.current) return;
            stopSpeaking();
            speakReminder(lastSpokenName.current, currentLang);
        };

        play();
        voiceInterval.current = setInterval(play, 5000); 
    };

    const stopVoiceLoop = () => {
        if (voiceInterval.current) { 
            clearInterval(voiceInterval.current); 
            voiceInterval.current = null; 
        }
        stopSpeaking();
    };

    const handleAction = async (action) => {
        if (!activeAlert) return;
        stopVoiceLoop();

        const medicineId = activeAlert.id;
        const slotKey = activeAlert._slotKey || medicineId;
        const medName = activeAlert.name;

        try { await notifee.cancelAllNotifications(); } catch (e) { }

        if (action === 'taken') {
            logAdherence(medicineId, 'taken', slotKey);
            updateSkipCount(medicineId, 'reset');
            if (updateSnoozeCount) updateSnoozeCount(medicineId, 'reset');
            if (updateIgnoredCount) updateIgnoredCount(medicineId, 'reset');
        } else if (action === 'snooze') {
            logAdherence(medicineId, 'postponed', slotKey);
            if (updateSnoozeCount) {
                const count = updateSnoozeCount(medicineId, 'increment');
                if (count >= 3) {
                    await triggerEscalation(medName);
                    updateSnoozeCount(medicineId, 'reset');
                } else {
                    const { scheduleAdhocNotification } = require('../utils/ReminderEngine');
                    await scheduleAdhocNotification(activeAlert, 10, currentLang);
                }
            }
        } else if (action === 'skip') {
            logAdherence(medicineId, 'missed', slotKey);
            const count = updateSkipCount(medicineId, 'increment');
            if (count >= 3) {
                await triggerEscalation(medName);
                updateSkipCount(medicineId, 'reset');
            } else {
                const { scheduleAdhocNotification } = require('../utils/ReminderEngine');
                await scheduleAdhocNotification(activeAlert, 5, currentLang);
            }
        }
        closeAlert();
    };

    if (!activeAlert) return null;

    const getMedicineImage = () => {
        const type = activeAlert.type?.toLowerCase() || '';
        if (type.includes('capsule')) return 'https://images.unsplash.com/photo-1550572017-4f51171d3d99?w=400&q=80';
        if (type.includes('syrup')) return 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80';
        return 'https://images.unsplash.com/photo-1550572017-edb799981a8b?w=400&q=80';
    };

    return (
        <Modal transparent visible={!!activeAlert} animationType="none" statusBarTranslucent onRequestClose={() => { stopVoiceLoop(); closeAlert(); }}>
            <View style={styles.overlay}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.95)' }]} />
                
                <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
                    <View style={styles.cardHeader}>
                        <View style={styles.iconCircle}><Ionicons name="notifications" size={32} color={colors.white} /></View>
                        <View style={{flex: 1}}>
                            <Text style={styles.alertTitle}>{t.title}</Text>
                            <Text style={styles.alarmStatus}>{t.alarm}</Text>
                        </View>
                    </View>
                    
                    <Image source={{ uri: getMedicineImage() }} style={styles.medVisual} resizeMode="cover" />
                    
                    <View style={styles.infoBox}>
                        <Text style={styles.medName}>{activeAlert.name}</Text>
                        <Text style={styles.medDosage}>{activeAlert.dosage || 'As directed'}</Text>
                    </View>
                    
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity style={[styles.actionButton, styles.takenButton]} onPress={() => handleAction('taken')}>
                            <Ionicons name="checkmark-circle" size={24} color={colors.white} />
                            <Text style={styles.buttonText}>{t.taken}</Text>
                        </TouchableOpacity>
                        
                        <View style={styles.secondaryButtons}>
                            <TouchableOpacity style={[styles.actionButton, styles.snoozeButton]} onPress={() => handleAction('snooze')}>
                                <Text style={[styles.buttonText, styles.darkText]}>{t.snooze}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionButton, styles.skipButton]} onPress={() => handleAction('skip')}>
                                <Text style={styles.buttonText}>{t.skip}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    <TouchableOpacity style={styles.dismissLink} onPress={() => { stopVoiceLoop(); closeAlert(); }}>
                        <Text style={styles.dismissText}>{t.dismiss}</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { width: '92%', paddingVertical: spacing.xl, borderRadius: radius.xxl, backgroundColor: colors.surface, alignItems: 'center', ...shadow.lg, overflow: 'hidden' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: spacing.xl, gap: spacing.md, marginBottom: spacing.lg },
    iconCircle: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    alertTitle: { fontSize: 18, fontWeight: '900', color: colors.textPrimary },
    alarmStatus: { fontSize: 12, fontWeight: '700', color: colors.error, marginTop: 2 },
    medVisual: { width: '100%', height: 160, marginBottom: spacing.xl },
    infoBox: { alignItems: 'center', paddingHorizontal: spacing.xl, marginBottom: spacing.xl },
    medName: { fontSize: 24, fontWeight: '900', color: colors.textPrimary, textAlign: 'center' },
    medDosage: { fontSize: 18, color: colors.primary, marginTop: 4, fontWeight: '700' },
    buttonContainer: { width: '100%', paddingHorizontal: spacing.xl, gap: spacing.md },
    actionButton: { flexDirection: 'row', paddingVertical: 16, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', gap: 10, ...shadow.sm },
    takenButton: { backgroundColor: colors.success },
    secondaryButtons: { flexDirection: 'row', gap: spacing.md },
    snoozeButton: { flex: 1, backgroundColor: colors.background, borderWidth: 2, borderColor: colors.warning },
    skipButton: { flex: 1, backgroundColor: colors.error },
    buttonText: { fontSize: 16, color: colors.white, fontWeight: '900' },
    darkText: { color: colors.textPrimary },
    dismissLink: { marginTop: spacing.xl, padding: spacing.sm },
    dismissText: { fontSize: 13, color: colors.textMuted, fontWeight: '700' },
});

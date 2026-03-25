import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Platform, AppState } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import notifee from '@notifee/react-native';
import { colors, spacing, radius, shadow } from '../constants/theme';

export default function PermissionCheckModal() {
    const [visible, setVisible] = useState(false);
    const [perms, setPerms] = useState({
        notifications: true,
        alarm: true,
        overlay: true,
        battery: true
    });

    const checkAll = async () => {
        if (Platform.OS !== 'android') return;

        const settings = await notifee.getNotificationSettings();
        const notificationGranted = settings.authorizationStatus >= 1; // 1 = Authorized

        // Check for exact alarm permission (Android 12+)
        const alarmStatus = await notifee.getNotificationSettings();
        // alarm property might be undefined on older Android versions where it's not required
        const alarmEnabled = Platform.Version >= 31 
            ? alarmStatus.android.alarm === 1 
            : true;

        // Check for overlay permission
        const overlayEnabled = await notifee.isSystemAlertWindowEnabled();

        // Check for battery optimization
        const batteryOptimizationEnabled = await notifee.isBatteryOptimizationEnabled();

        const newPerms = {
            notifications: notificationGranted,
            alarm: alarmEnabled,
            overlay: overlayEnabled,
            battery: !batteryOptimizationEnabled // true means it's ALREADY optimized (undesired)
        };

        setPerms(newPerms);

        // Show modal if ANY requirement is missing
        const anyMissing = !notificationGranted || !alarmEnabled || !overlayEnabled || batteryOptimizationEnabled;
        setVisible(anyMissing);
    };

    useEffect(() => {
        checkAll();
        const sub = AppState.addEventListener('change', (next) => {
            if (next === 'active') checkAll();
        });
        return () => sub.remove();
    }, []);

    const fixPerm = async (type) => {
        try {
            switch (type) {
                case 'notifications':
                    await Notifications.requestPermissionsAsync();
                    break;
                case 'alarm':
                    await notifee.openAlarmSettings();
                    break;
                case 'overlay':
                    await notifee.openSystemAlertWindowSettings();
                    break;
                case 'battery':
                    await notifee.stopBatteryOptimization();
                    break;
            }
        } catch (err) {
            console.error('Failed to open settings:', err);
            Linking.openSettings();
        }
        setTimeout(checkAll, 1000);
    };

    if (!visible) return null;

    const PermRow = ({ title, status, type, icon }) => (
        <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: status ? colors.successLight : colors.errorLight }]}>
                <MaterialCommunityIcons name={icon} size={22} color={status ? colors.success : colors.error} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{title}</Text>
                <Text style={[styles.rowStatus, { color: status ? colors.success : colors.error }]}>
                    {status ? 'Permission Granted' : 'Required Action'}
                </Text>
            </View>
            {!status && (
                <TouchableOpacity style={styles.fixBtn} onPress={() => fixPerm(type)}>
                    <Text style={styles.fixTxt}>Fix Now</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.box}>
                    <View style={styles.header}>
                        <View style={styles.warningIcon}>
                            <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
                        </View>
                        <Text style={styles.title}>System Permissions</Text>
                        <Text style={styles.subtitle}>Critical permissions are required for medicine alerts to work reliably.</Text>
                    </View>

                    <View style={styles.list}>
                        <PermRow title="Medicine Reminders" status={perms.notifications} type="notifications" icon="bell-ring" />
                        <PermRow title="Exact Time Alarms" status={perms.alarm} type="alarm" icon="clock-check" />
                        <PermRow title="Full Screen Alert" status={perms.overlay} type="overlay" icon="monitor-screenshot" />
                        <PermRow title="Battery Performance" status={perms.battery} type="battery" icon="battery-off-outline" />
                    </View>

                    <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)}>
                        <Text style={styles.closeTxt}>I'll do it later</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    box: { backgroundColor: colors.surface, borderRadius: radius.xxl, width: '100%', maxWidth: 400, padding: 24, ...shadow.lg },
    header: { alignItems: 'center', marginBottom: 24 },
    warningIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 20, fontWeight: '900', color: colors.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
    list: { gap: 16, marginBottom: 24 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
    iconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    rowStatus: { fontSize: 12, fontWeight: '600', marginTop: 1 },
    fixBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.md },
    fixTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
    closeBtn: { alignSelf: 'center', padding: 8 },
    closeTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' }
});

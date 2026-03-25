import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Switch, TextInput, Modal, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMedicines } from '../../context/MedicineContext';
import { useToast } from '../../context/ToastContext';
import { colors, spacing, radius, shadow } from '../../constants/theme';

// ─── SettingRow ────────────────────────────────────────────────────────────────
function SettingRow({ icon, label, value, onPress, rightElement, danger }) {
    return (
        <TouchableOpacity
            style={s.settingRow}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={onPress ? 0.7 : 1}
        >
            <View style={[s.settingIcon, danger && { backgroundColor: colors.errorLight }]}>
                {icon}
            </View>
            <View style={s.settingContent}>
                <Text style={[s.settingLabel, danger && { color: colors.error }]}>{label}</Text>
                {value ? <Text style={s.settingValue}>{value}</Text> : null}
            </View>
            {rightElement ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null)}
        </TouchableOpacity>
    );
}

// ─── EditProfileModal ──────────────────────────────────────────────────────────
function EditProfileModal({ visible, user, onSave, onClose }) {
    const [username, setUsername] = useState(user?.username || '');
    const [email, setEmail] = useState(user?.email || '');
    const [caretaker, setCaretaker] = useState(user?.caretakerEmail || '');
    const [loading, setLoading] = useState(false);
    const { showSuccess, showError } = useToast();

    useEffect(() => {
        setUsername(user?.username || '');
        setEmail(user?.email || '');
        setCaretaker(user?.caretakerEmail || '');
    }, [user]);

    const handleSave = async () => {
        if (!username.trim()) { showError('Username cannot be empty.'); return; }
        if (!email.trim()) { showError('Email cannot be empty.'); return; }
        setLoading(true);
        try {
            const updated = {
                ...user,
                username: username.trim(),
                email: email.trim(),
                caretakerEmail: caretaker.trim()
            };
            await AsyncStorage.setItem('user', JSON.stringify(updated));
            showSuccess('Profile updated successfully!');
            onSave(updated);
        } catch {
            showError('Failed to update profile.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={m.overlay}>
                <View style={m.sheet}>
                    <View style={m.handle} />
                    <Text style={m.title}>Edit Profile</Text>

                    <Text style={m.label}>Your Name</Text>
                    <TextInput style={m.input} value={username} onChangeText={setUsername}
                        autoCapitalize="words" />

                    <Text style={m.label}>Email Address</Text>
                    <TextInput style={m.input} value={email} onChangeText={setEmail}
                        autoCapitalize="none" keyboardType="email-address" />

                    <Text style={m.label}>Caretaker Email</Text>
                    <Text style={m.hint}>This person will be alerted if you miss doses repeatedly</Text>
                    <TextInput style={m.input} value={caretaker} onChangeText={setCaretaker}
                        autoCapitalize="none" keyboardType="email-address" />

                    <View style={m.row}>
                        <TouchableOpacity style={m.cancelBtn} onPress={onClose} disabled={loading}>
                            <Text style={m.cancelTxt}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[m.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={m.saveTxt}>Save</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
    const { prescriptions, adherenceLogs } = useMedicines();
    const { showSuccess, showError } = useToast();
    const router = useRouter();

    const [user, setUser] = useState(null);
    const [editVisible, setEditVisible] = useState(false);
    const [logoutConfirm, setLogoutConfirm] = useState(false);

    useEffect(() => { loadUser(); }, []);

    const loadUser = async () => {
        try {
            const raw = await AsyncStorage.getItem('user');
            if (raw) setUser(JSON.parse(raw));
        } catch { }
    };

    const handleLogout = async () => {
        try {
            await AsyncStorage.removeItem('user');
            router.replace('/');
            showSuccess('Logged out successfully.');
        } catch { showError('Logout failed. Please try again.'); }
    };

    const stats = {
        prescriptions: prescriptions.length,
        medicines: prescriptions.reduce((s, p) => s + (p.medicines?.length || 0), 0),
        taken: adherenceLogs.filter(l => l.status === 'taken').length,
        missed: adherenceLogs.filter(l => l.status === 'missed').length,
    };

    const initials = user?.username
        ? user.username.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : user?.email ? user.email.slice(0, 2).toUpperCase() : '??';

    return (
        <SafeAreaView style={s.container}>
            <View style={s.header}>
                <Text style={s.headerTitle}>Profile</Text>
            </View>

            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                {/* Avatar Card */}
                <View style={s.avatarCard}>
                    <View style={s.avatarRing}>
                        <Text style={s.avatarText}>{initials}</Text>
                    </View>
                    <Text style={s.userName}>{user?.username || user?.email || 'Not logged in'}</Text>
                    {user?.username && <Text style={s.userEmail}>{user.email}</Text>}
                    {user?.caretakerEmail && (
                        <View style={s.caretakerRow}>
                            <Ionicons name="people-outline" size={13} color={colors.textMuted} />
                            <Text style={s.caretakerTxt}>Caretaker: {user.caretakerEmail}</Text>
                        </View>
                    )}
                    <TouchableOpacity style={s.editBtn} onPress={() => setEditVisible(true)}>
                        <MaterialIcons name="edit" size={14} color={colors.primary} />
                        <Text style={s.editBtnTxt}>Edit Profile</Text>
                    </TouchableOpacity>
                </View>

                {/* Quick Stats */}
                <Text style={s.sectionLabel}>YOUR OVERVIEW</Text>
                <View style={s.statsGrid}>
                    {[
                        { label: 'Prescriptions', value: stats.prescriptions, icon: 'file-medical', color: colors.primary, bg: colors.primaryLight },
                        { label: 'Medicines', value: stats.medicines, icon: 'pills', color: '#5856D6', bg: '#EDE9FF' },
                        { label: 'Doses Taken', value: stats.taken, icon: 'check-circle', color: colors.success, bg: colors.successLight },
                        { label: 'Doses Missed', value: stats.missed, icon: 'times-circle', color: colors.error, bg: colors.errorLight },
                    ].map(item => (
                        <View key={item.label} style={[s.statCard, { borderColor: item.bg }]}>
                            <View style={[s.statIcon, { backgroundColor: item.bg }]}>
                                <FontAwesome5 name={item.icon} size={16} color={item.color} />
                            </View>
                            <Text style={[s.statValue, { color: item.color }]}>{item.value}</Text>
                            <Text style={s.statLabel}>{item.label}</Text>
                        </View>
                    ))}
                </View>

                {/* Settings Groups */}
                <Text style={s.sectionLabel}>ACTIVITY</Text>
                <View style={s.settingGroup}>
                    <SettingRow
                        icon={<Ionicons name="stats-chart" size={18} color={colors.primary} />}
                        label="Adherence Dashboard"
                        value="View your medication stats"
                        onPress={() => router.push('/adherence-dashboard')}
                    />
                    <View style={s.divider} />
                    <SettingRow
                        icon={<Ionicons name="time-outline" size={18} color="#5856D6" />}
                        label="Dose History"
                        value={`${adherenceLogs.length} total log entries`}
                        onPress={() => router.push('/adherence-dashboard')}
                    />
                </View>

                <Text style={s.sectionLabel}>ACCOUNT</Text>
                <View style={s.settingGroup}>
                    <SettingRow
                        icon={<Ionicons name="mail-outline" size={18} color={colors.primary} />}
                        label="Email"
                        value={user?.email || 'Not set'}
                        onPress={() => setEditVisible(true)}
                    />
                    <View style={s.divider} />
                    <SettingRow
                        icon={<Ionicons name="people-outline" size={18} color={colors.success} />}
                        label="Caretaker Email"
                        value={user?.caretakerEmail || 'Not configured'}
                        onPress={() => setEditVisible(true)}
                    />
                </View>

                <Text style={s.sectionLabel}>ABOUT</Text>
                <View style={s.settingGroup}>
                    <SettingRow
                        icon={<Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />}
                        label="App Version"
                        value="1.0.0"
                    />
                    <View style={s.divider} />
                    <SettingRow
                        icon={<Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />}
                        label="Privacy Notice"
                        value="Data stored locally on your device"
                    />
                </View>

                {/* Logout */}
                <TouchableOpacity style={s.logoutBtn} onPress={() => setLogoutConfirm(true)}>
                    <Ionicons name="log-out-outline" size={20} color={colors.error} />
                    <Text style={s.logoutTxt}>Sign Out</Text>
                </TouchableOpacity>

                <View style={{ height: 48 }} />
            </ScrollView>

            {/* Edit Profile Modal */}
            <EditProfileModal
                visible={editVisible}
                user={user}
                onSave={(updated) => { setUser(updated); setEditVisible(false); }}
                onClose={() => setEditVisible(false)}
            />

            {/* Logout Confirm */}
            <Modal visible={logoutConfirm} transparent animationType="fade" onRequestClose={() => setLogoutConfirm(false)}>
                <View style={m.overlay}>
                    <View style={[m.sheet, { maxHeight: 280 }]}>
                        <View style={m.handle} />
                        <View style={{ alignItems: 'center', marginBottom: 16 }}>
                            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.errorLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                                <Ionicons name="log-out-outline" size={26} color={colors.error} />
                            </View>
                            <Text style={m.title}>Sign Out</Text>
                            <Text style={[m.hint, { marginTop: 4 }]}>Are you sure you want to sign out? Your data will remain saved on this device.</Text>
                        </View>
                        <View style={m.row}>
                            <TouchableOpacity style={m.cancelBtn} onPress={() => setLogoutConfirm(false)}>
                                <Text style={m.cancelTxt}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[m.saveBtn, { backgroundColor: colors.error }]} onPress={handleLogout}>
                                <Text style={m.saveTxt}>Sign Out</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.md, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    content: { padding: spacing.md, gap: 6 },
    avatarCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: 20, ...shadow.sm },
    avatarRing: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    avatarText: { fontSize: 26, fontWeight: '900', color: '#fff' },
    userName: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
    userEmail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    caretakerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    caretakerTxt: { fontSize: 12, color: colors.textMuted },
    editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, backgroundColor: colors.primaryLight, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full },
    editBtnTxt: { fontSize: 13, fontWeight: '700', color: colors.primary },
    sectionLabel: { fontSize: 11, fontWeight: '800', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginTop: 16, marginBottom: 8, marginLeft: 4 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
    statCard: { width: '47%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, alignItems: 'center', borderWidth: 1, ...shadow.sm, gap: 6 },
    statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    statValue: { fontSize: 26, fontWeight: '900' },
    statLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
    settingGroup: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 6 },
    settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
    settingIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    settingContent: { flex: 1 },
    settingLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    settingValue: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    divider: { height: 1, backgroundColor: colors.border, marginLeft: 64 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.errorLight, height: 52, borderRadius: radius.md, marginTop: 16, borderWidth: 1, borderColor: colors.error + '30' },
    logoutTxt: { fontSize: 16, fontWeight: '700', color: colors.error },
});

const m = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 16, textAlign: 'center' },
    label: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    hint: { fontSize: 12, color: colors.textMuted, marginBottom: 8, textAlign: 'center' },
    input: { backgroundColor: colors.background, borderRadius: radius.md, padding: 14, fontSize: 15, fontWeight: '600', color: colors.textPrimary, borderWidth: 1.5, borderColor: colors.border, marginBottom: 16 },
    row: { flexDirection: 'row', gap: 10, marginTop: 8 },
    cancelBtn: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
    cancelTxt: { fontWeight: '700', color: colors.textSecondary, fontSize: 15 },
    saveBtn: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    saveTxt: { fontWeight: '700', color: '#fff', fontSize: 15 },
});

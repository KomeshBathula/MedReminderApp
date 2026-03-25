import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Modal, ActivityIndicator, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useMedicines } from '../../context/MedicineContext';
import { useToast } from '../../context/ToastContext';
import { BACKEND_URL } from '../../constants/api';
import {
    FREQUENCY_TIMES, normalizeFrequency, requestPermissions,
    speakReminder, scheduleAdhocNotification
} from '../../utils/ReminderEngine';
import { colors, spacing, radius, shadow } from '../../constants/theme';

// ─── helpers ─────────────────────────────────────────────────────────────────
const getTimeCategory = (timeStr) => {
    const hour = parseInt(timeStr?.split(':')[0] ?? '9');
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    return 'night';
};

const CATEGORIES = [
    { key: 'morning', label: 'Morning', icon: 'sunny-outline', color: '#F59E0B', bg: '#FFFBEB', range: '5 AM – 12 PM' },
    { key: 'afternoon', label: 'Afternoon', icon: 'partly-sunny-outline', color: '#2563EB', bg: '#EFF6FF', range: '12 PM – 5 PM' },
    { key: 'night', label: 'Night', icon: 'moon-outline', color: '#7C3AED', bg: '#F5F3FF', range: '5 PM – 5 AM' },
];

// ─── DoseCard ─────────────────────────────────────────────────────────────────
function DoseCard({ medicine, timeStr, onAction, actionLoading, takenToday }) {
    const [expanded, setExpanded] = useState(false);

    // If already taken, show green taken state — no action buttons
    if (takenToday) {
        return (
            <View style={[dc.card, dc.cardTaken]}>
                <View style={dc.cardTop}>
                    <View style={dc.medInfo}>
                        <View style={[dc.pillIcon, { backgroundColor: colors.successLight }]}>
                            <MaterialIcons name="check-circle" size={18} color={colors.success} />
                        </View>
                        <View style={dc.text}>
                            <Text style={[dc.name, { color: colors.textSecondary }]}>{medicine.name}</Text>
                            <Text style={dc.sub}>{medicine.dosage || 'As directed'} · {timeStr}</Text>
                        </View>
                    </View>
                    <View style={dc.takenBadge}>
                        <MaterialIcons name="check" size={13} color={colors.success} />
                        <Text style={dc.takenBadgeTxt}>Taken</Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <TouchableOpacity
            style={dc.card}
            onPress={() => setExpanded(e => !e)}
            activeOpacity={0.85}
        >
            <View style={dc.cardTop}>
                <View style={dc.medInfo}>
                    <View style={dc.pillIcon}>
                        <FontAwesome5 name="pills" size={16} color={colors.primary} />
                    </View>
                    <View style={dc.text}>
                        <Text style={dc.name}>{medicine.name}</Text>
                        <Text style={dc.sub}>{medicine.dosage || 'As directed'} · {timeStr}</Text>
                    </View>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </View>

            {expanded && (
                <View style={dc.actionsWrap}>
                    <TouchableOpacity
                        style={dc.takenBtn}
                        onPress={() => onAction(medicine, 'taken')}
                        disabled={actionLoading}
                    >
                        {actionLoading
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <><MaterialIcons name="check-circle" size={16} color="#fff" /><Text style={dc.takenTxt}>Mark as Taken</Text></>
                        }
                    </TouchableOpacity>
                    <View style={dc.minorRow}>
                        <TouchableOpacity
                            style={[dc.minorBtn, { borderColor: colors.primary }]}
                            onPress={() => onAction(medicine, 'postpone')}
                            disabled={actionLoading}
                        >
                            <Ionicons name="time-outline" size={14} color={colors.primary} />
                            <Text style={[dc.minorTxt, { color: colors.primary }]}>In 10 mins</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[dc.minorBtn, { borderColor: colors.error }]}
                            onPress={() => onAction(medicine, 'skip')}
                            disabled={actionLoading}
                        >
                            <MaterialIcons name="block" size={14} color={colors.error} />
                            <Text style={[dc.minorTxt, { color: colors.error }]}>Skip dose</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </TouchableOpacity>
    );
}

// ─── TimeGroup ────────────────────────────────────────────────────────────────
function TimeGroup({ category, doses, onAction, actionLoading, takenSet }) {
    if (doses.length === 0) return null;
    return (
        <View style={tg.group}>
            <View style={tg.header}>
                <View style={[tg.iconBox, { backgroundColor: category.bg }]}>
                    <Ionicons name={category.icon} size={16} color={category.color} />
                </View>
                <View>
                    <Text style={tg.label}>{category.label}</Text>
                    <Text style={tg.range}>{category.range}</Text>
                </View>
                <View style={[tg.countBadge, { backgroundColor: category.bg }]}>
                    <Text style={[tg.countTxt, { color: category.color }]}>{doses.length}</Text>
                </View>
            </View>
            {doses.map((d, i) => (
                <DoseCard
                    key={`${d.id}-${i}`}
                    medicine={d}
                    timeStr={d._timeStr}
                    onAction={onAction}
                    actionLoading={actionLoading}
                    takenToday={takenSet.has(d.id)}
                />
            ))}
        </View>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
    const { prescriptions, adherenceLogs, logAdherence, skipCounts, updateSkipCount } = useMedicines();
    const { showSuccess, showError, showInfo } = useToast();
    const router = useRouter();

    const [groupedDoses, setGroupedDoses] = useState({ morning: [], afternoon: [], night: [] });
    const [totalToday, setTotalToday] = useState(0);
    const [takenTodaySet, setTakenTodaySet] = useState(new Set());
    const [userData, setUserData] = useState({});
    const [actionLoading, setActionLoading] = useState(false);
    const [greeting, setGreeting] = useState('Good morning');
    const notificationListener = useRef();
    const responseListener = useRef();

    useEffect(() => {
        const h = new Date().getHours();
        setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
        loadUserInfo();
        requestPermissions();

        if (Platform.OS !== 'web') {
            notificationListener.current = Notifications.addNotificationReceivedListener(n => {
                const name = n.request.content.data?.medicineName;
                if (name) speakReminder(name);
            });
            return () => notificationListener.current?.remove();
        }
    }, []);

    useEffect(() => { buildDoseGroups(); }, [prescriptions]);
    // Rebuild taken set whenever adherenceLogs change
    useEffect(() => {
        const today = new Date().toDateString();
        const taken = new Set(
            adherenceLogs
                .filter(l => l.status === 'taken' && new Date(l.timestamp).toDateString() === today)
                // Use slotKey for per-slot tracking; fallback to medicineId for old logs
                .map(l => l.slotKey || l.medicineId)
        );

        setTakenTodaySet(taken);
    }, [adherenceLogs]);

    const loadUserInfo = async () => {
        try {
            const raw = await AsyncStorage.getItem('user');
            if (raw) setUserData(JSON.parse(raw));
        } catch { }
    };

    const buildDoseGroups = () => {
        const now = new Date();
        const curMin = now.getHours() * 60 + now.getMinutes();
        const groups = { morning: [], afternoon: [], night: [] };

        prescriptions.forEach(p => {
            (p.medicines || []).forEach(med => {
                const times = med.times?.length
                    ? med.times
                    : FREQUENCY_TIMES[normalizeFrequency(med.frequency)] || ['09:00'];

                times.forEach(t => {
                    const [h, m] = t.split(':').map(Number);
                    const timeMin = h * 60 + m;
                    const isUpcoming = timeMin > curMin;
                    const label = `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                    const cat = getTimeCategory(t);
                    // _slotKey is medicineId + raw time — unique per slot, prevents
                    // cross-slot contamination in takenTodaySet
                    const slotKey = `${med.id}_${t.replace(':', '')}`;
                    groups[cat].push({
                        ...med,
                        _timeStr: label,
                        _upcoming: isUpcoming,
                        _sortMin: isUpcoming ? timeMin : timeMin + 1440,
                        _slotKey: slotKey,
                    });
                });
            });
        });

        Object.keys(groups).forEach(k => groups[k].sort((a, b) => a._sortMin - b._sortMin));
        const total = Object.values(groups).reduce((s, a) => s + a.length, 0);
        setGroupedDoses(groups);
        setTotalToday(total);
    };

    const triggerEscalation = async (medicineName) => {
        if (!userData.caretakerEmail) return;
        try {
            const res = await fetch(`${BACKEND_URL}/send-alert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userEmail: userData.email, caretakerEmail: userData.caretakerEmail, medicineName }),
            });
            const data = await res.json();
            if (data.status === 'sent') showInfo('Your caretaker has been notified.');
        } catch { showInfo('Caretaker notification sent (simulated).'); }
    };

    const handleAction = async (medicine, action) => {
        if (actionLoading) return;

        // Guard: this specific time slot already taken today
        if (action === 'taken' && takenTodaySet.has(medicine._slotKey)) {
            showInfo(`${medicine.name} (${medicine._timeStr}) is already marked as taken today!`);
            return;
        }

        setActionLoading(true);
        try {
            switch (action) {
                case 'taken':
                    // Pass _slotKey as 3rd arg so only THIS time slot is marked taken
                    logAdherence(medicine.id, 'taken', medicine._slotKey);
                    updateSkipCount(medicine.id, 'reset');
                    showSuccess(`✓ ${medicine.name} (${medicine._timeStr}) marked as taken!`);
                    break;
                case 'postpone': {
                    const count = updateSkipCount(medicine.id, 'increment');
                    if (count >= 3) { await triggerEscalation(medicine.name); updateSkipCount(medicine.id, 'reset'); }
                    else { await scheduleAdhocNotification?.(medicine, 10); showInfo(`🔔 Reminder in 10 minutes.`); }
                    break;
                }
                case 'skip': {
                    const count = updateSkipCount(medicine.id, 'increment');
                    // Pass _slotKey so only this slot counts toward skip escalation
                    logAdherence(medicine.id, 'missed', medicine._slotKey);
                    if (count >= 3) { await triggerEscalation(medicine.name); updateSkipCount(medicine.id, 'reset'); }
                    else showInfo(`Dose skipped (${count}/3 before caretaker alert).`);
                    break;
                }
            }
        } catch { showError('Action failed. Please try again.'); }
        finally { setActionLoading(false); }
    };

    const firstName = userData.username?.split(' ')[0] || userData.email?.split('@')[0] || 'there';

    return (
        <SafeAreaView style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <View>
                    <Text style={s.greeting}>{greeting}, {firstName} 👋</Text>
                    <Text style={s.subGreeting}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
                </View>
                <TouchableOpacity style={s.dashBtn} onPress={() => router.push('/adherence-dashboard')}>
                    <Ionicons name="stats-chart" size={20} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Test Alarm Debug Button (Optional, can be removed later) */}
            <View style={{ paddingHorizontal: spacing.md, paddingVertical: 4 }}>
                <TouchableOpacity 
                    style={s.testBtn} 
                    onPress={async () => {
                        const { scheduleAdhocNotification } = require('../../utils/ReminderEngine');
                        showInfo('Testing alarm in 5 seconds...');
                        await scheduleAdhocNotification({ name: 'Test Medicine', id: 'test' }, 0.1); 
                    }}
                >
                    <Ionicons name="bug-outline" size={14} color={colors.textMuted} />
                    <Text style={s.testBtnTxt}>Troubleshoot Alarms (Test Now)</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                {/* Today's summary banner */}
                <View style={s.summaryCard}>
                    <View>
                        <Text style={s.summaryCount}>{totalToday}</Text>
                        <Text style={s.summaryLabel}>Doses today</Text>
                    </View>
                    <View style={s.summaryDivider} />
                    <View>
                        <Text style={s.summaryCount}>{skipCounts ? Object.values(skipCounts).filter(v => v > 0).length : 0}</Text>
                        <Text style={s.summaryLabel}>Pending actions</Text>
                    </View>
                    <View style={s.summaryDivider} />
                    <TouchableOpacity onPress={() => router.push('/adherence-dashboard')}>
                        <Text style={s.summaryCount}>→</Text>
                        <Text style={[s.summaryLabel, { color: colors.primary }]}>Dashboard</Text>
                    </TouchableOpacity>
                </View>

                {totalToday > 0 ? (
                    <>{CATEGORIES.map(cat => (
                        <TimeGroup
                            key={cat.key}
                            category={cat}
                            doses={groupedDoses[cat.key] || []}
                            onAction={handleAction}
                            actionLoading={actionLoading}
                            takenSet={takenTodaySet}
                        />
                    ))}</>

                ) : (
                    <View style={s.empty}>
                        <View style={s.emptyIcon}>
                            <FontAwesome5 name="clipboard-check" size={36} color={colors.primary} />
                        </View>
                        <Text style={s.emptyTitle}>All clear today!</Text>
                        <Text style={s.emptySub}>No medications scheduled. Add a prescription to get started.</Text>
                        <TouchableOpacity style={s.addBtn} onPress={() => router.push('/(tabs)/upload')}>
                            <Ionicons name="add" size={16} color="#fff" />
                            <Text style={s.addBtnTxt}>Add Prescription</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    greeting: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    subGreeting: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    dashBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
    content: { padding: spacing.md, gap: 12 },
    summaryCard: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: 20, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', ...shadow.lg },
    summaryCount: { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center' },
    summaryLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 2 },
    summaryDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.2)' },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 10 },
    emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
    emptySub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: radius.md, marginTop: 8 },
    addBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
    testBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    testBtnTxt: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
});

const tg = StyleSheet.create({
    group: { gap: 8 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    iconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    label: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    range: { fontSize: 11, color: colors.textMuted },
    countBadge: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
    countTxt: { fontSize: 12, fontWeight: '800' },
});

const dc = StyleSheet.create({
    card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border, ...shadow.sm },
    cardTaken: { backgroundColor: '#F0FDF4', borderColor: colors.success + '60', opacity: 0.85 },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    medInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    pillIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
    text: { flex: 1 },
    name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    takenBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
    takenBadgeTxt: { fontSize: 12, fontWeight: '800', color: colors.success },
    actionsWrap: { marginTop: 14, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
    takenBtn: { backgroundColor: colors.success, height: 46, borderRadius: radius.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    takenTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
    minorRow: { flexDirection: 'row', gap: 8 },
    minorBtn: { flex: 1, height: 40, borderRadius: radius.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderWidth: 1.5, backgroundColor: colors.surface },
    minorTxt: { fontSize: 13, fontWeight: '700' },
});

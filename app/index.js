import {
    View, StyleSheet, Image, Text, TouchableOpacity,
    ActivityIndicator, ImageBackground
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useMedicines } from '../context/MedicineContext';
import { colors, spacing, radius, shadow } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen() {
    const { isInitialized, userData } = useMedicines();
    const router = useRouter();

    useEffect(() => {
        if (isInitialized && userData) {
            console.log('[WelcomeScreen] Redirecting to home.');
            router.replace('/(tabs)/home');
        }
    }, [isInitialized, userData]);

    if (!isInitialized) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (userData) {
        return <View style={{ flex: 1, backgroundColor: colors.background }} />;
    }

    return (
        <SafeAreaView style={styles.container}>
            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1576091160550-217359f42f57?w=800&q=80' }}
                style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.7)' }]} />

            <View style={styles.content}>
                <View style={styles.logoCircle}>
                    <Ionicons name="medical" size={40} color={colors.primary} />
                </View>
                <View style={styles.heroText}>
                    <Text style={styles.title}>MedReminder</Text>
                    <Text style={styles.subtitle}>Your daily health companion for medication tracking and reminders.</Text>
                </View>

                <View style={styles.buttonGroup}>
                    <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() => router.push('/auth/login')}
                    >
                        <Text style={styles.primaryBtnText}>Get Started</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() => router.push('/auth/register')}
                    >
                        <Text style={styles.secondaryBtnText}>Create Account</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1, padding: 32, justifyContent: 'center', alignItems: 'center', gap: 40 },
    logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', ...shadow.md },
    heroText: { alignItems: 'center', gap: 12 },
    title: { fontSize: 36, fontWeight: '900', color: colors.textPrimary, letterSpacing: -1 },
    subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 24, paddingHorizontal: 20 },
    buttonGroup: { width: '100%', gap: 16 },
    primaryBtn: { flexDirection: 'row', backgroundColor: colors.primary, paddingVertical: 18, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center', gap: 10, ...shadow.md },
    primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
    secondaryBtn: { paddingVertical: 18, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.5)' },
    secondaryBtnText: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
});

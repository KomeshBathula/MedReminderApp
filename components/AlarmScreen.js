import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { MedicineProvider } from '../context/MedicineContext';
import { ToastProvider } from '../context/ToastContext';
import FullScreenAlert from './FullScreenAlert';
import { colors } from '../constants/theme';

export default function AlarmScreen() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setReady(true), 300);
        return () => clearTimeout(timer);
    }, []);

    if (!ready) return null;

    return (
        <ToastProvider>
            <MedicineProvider>
                <View style={styles.container}>
                    <FullScreenAlert />
                </View>
            </MedicineProvider>
        </ToastProvider>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: colors.background // Fallback background if modal isn't showing yet
    },
});


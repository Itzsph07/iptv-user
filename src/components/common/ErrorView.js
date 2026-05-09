// src/components/common/ErrorView.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

export const ErrorView = ({ 
  message, 
  onRetry, 
  fullScreen = false,
  showIcon = true,
}) => {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      {showIcon && (
        <Ionicons name="alert-circle" size={48} color={COLORS.primary} />
      )}
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  message: {
    color: COLORS.primary,
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 12,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 4,
  },
  retryText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
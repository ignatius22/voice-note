import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAppState } from '../app/AppProvider';
import { AuthScreen } from '../screens/AuthScreen';
import { DealEditorScreen } from '../screens/DealEditorScreen';
import { DealsListScreen } from '../screens/DealsListScreen';

export type AuthStackParamList = {
  Auth: undefined;
};

export type AppStackParamList = {
  DealsList: undefined;
  DealEditor: { dealId?: string } | undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Auth" component={AuthScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator>
      <AppStack.Screen
        name="DealsList"
        component={DealsListScreen}
        options={{ title: 'Creator Deal Vault' }}
      />
      <AppStack.Screen
        name="DealEditor"
        component={DealEditorScreen}
        options={{ title: 'Deal Editor' }}
      />
    </AppStack.Navigator>
  );
}

function LaunchScreen() {
  return (
    <View style={styles.centeredContainer}>
      <ActivityIndicator size="small" color="#1f2937" />
      <Text style={styles.statusText}>Restoring session...</Text>
    </View>
  );
}

export function RootNavigator() {
  const { session, isRestoringSession } = useAppState();

  if (isRestoringSession) {
    return <LaunchScreen />;
  }

  return (
    <NavigationContainer>
      {session ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
  },
  statusText: {
    fontSize: 16,
    color: '#1f2937',
  },
});

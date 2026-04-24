import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import DashboardScreen from './src/screens/DashboardScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import TotalsScreen from './src/screens/TotalsScreen';
import { RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Dashboard">
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Lumen' }} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Capture" component={CaptureScreen} />
          <Stack.Screen name="Totals" component={TotalsScreen} options={{ title: 'Total Screen Time' }} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

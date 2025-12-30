import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TextInput, Button, Text, SafeAreaView, ActivityIndicator, Alert, TouchableOpacity, AppState } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';

export default function App() {
  const [details, setDetails] = useState({ roll: '', name: '', email: '' });
  const [currentUrl, setCurrentUrl] = useState(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    loadDetails();
    checkInitialLink();

    const linkSubscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        checkClipboard(); 
      }
      appState.current = nextAppState;
    });

    return () => {
      linkSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  const loadDetails = async () => {
    try {
      const saved = await AsyncStorage.getItem('user_details');
      if (saved) {
        setDetails(JSON.parse(saved));
        setIsConfigured(true);
      }
      setLoading(false);
    } catch (e) { setLoading(false); }
  };

  const saveDetails = async () => {
    if(!details.roll || !details.name || !details.email) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    await AsyncStorage.setItem('user_details', JSON.stringify(details));
    setIsConfigured(true);
  };

  const checkInitialLink = async () => {
    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) handleUrl(initialUrl);
    else checkClipboard(); 
  };

  const handleUrl = (url) => {
    if (url && (url.includes('forms.office.com') || url.includes('forms.microsoft.com'))) {
      setCurrentUrl(url);
    }
  };

  const checkClipboard = async () => {
    if (currentUrl) return; 

    const content = await Clipboard.getStringAsync();
    const cleanContent = content.trim(); 

    if (cleanContent && (
        cleanContent.includes('forms.office.com') || 
        cleanContent.includes('forms.microsoft.com') || 
        cleanContent.includes('forms.cloud.microsoft')
    )) {
      Alert.alert(
        "Link Detected",
        "Found a Forms link in your clipboard. Open it?",
        [
          { text: "No", style: "cancel" },
          { text: "Yes", onPress: () => setCurrentUrl(cleanContent) }
        ]
      );
    }
  };

  const injectionScript = `
    (function() {
      const myData = ["${details.roll}", "${details.name}", "${details.email}"];
      function attemptFill() {
        const inputs = Array.from(document.querySelectorAll('input'))
             .filter(el => (el.type === 'text' || el.type === 'email'));
             
        if (inputs.length >= 3) {
           myData.forEach((val, index) => {
             if(inputs[index] && inputs[index].value !== val) {
               const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
               nativeSetter.call(inputs[index], val);
               inputs[index].dispatchEvent(new Event('input', { bubbles: true }));
               inputs[index].dispatchEvent(new Event('change', { bubbles: true }));
             }
           });
        }
      }
      setInterval(attemptFill, 1000);
    })();
    true;
  `;

  if (loading) return <ActivityIndicator style={{flex:1}} />;

  if (!isConfigured) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>Attendance Setup</Text>
        <Text style={styles.subtext}>Enter details once. We'll save them.</Text>
        
        <TextInput style={styles.input} placeholder="Roll Number" value={details.roll} onChangeText={(t) => setDetails({...details, roll: t})} />
        <TextInput style={styles.input} placeholder="Full Name" value={details.name} onChangeText={(t) => setDetails({...details, name: t})} />
        <TextInput style={styles.input} placeholder="College Email" value={details.email} onChangeText={(t) => setDetails({...details, email: t})} />
        
        <Button title="Save Details" onPress={saveDetails} />
      </SafeAreaView>
    );
  }

  if (!currentUrl) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>Ready to Attend!</Text>
        <View style={styles.card}>
          <Text style={styles.instruction}>How to use:</Text>
          <Text style={styles.step}>1. Click the link in WhatsApp {"\n"}(Select this app)</Text>
          <Text style={{textAlign:'center', marginVertical:10}}>- OR -</Text>
          <Text style={styles.step}>2. Copy link & Open this app</Text>
        </View>

        <Button title="Check Clipboard Now" onPress={checkClipboard} />
        
        <TouchableOpacity style={{marginTop: 40}} onPress={() => setIsConfigured(false)}>
           <Text style={{color: 'blue'}}>Edit My Details</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.bar}>
          <Text style={{fontWeight:'bold', color: 'green'}}>• Auto-Filling Active</Text>
          <TouchableOpacity onPress={() => setCurrentUrl(null)}>
            <Text style={{ color: 'red', fontWeight: 'bold', padding: 10 }}>CLOSE</Text>
          </TouchableOpacity>
      </View>
      <WebView 
        source={{ uri: currentUrl }}
        injectedJavaScript={injectionScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subtext: { marginBottom: 20, color: '#666' },
  input: { width: '100%', height: 50, backgroundColor: 'white', borderColor: '#ddd', borderWidth: 1, marginBottom: 15, paddingHorizontal: 10, borderRadius: 8 },
  bar: { height: 50, backgroundColor: '#e8f5e9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 10, width: '100%', marginBottom: 30, elevation: 2 },
  instruction: { fontWeight: 'bold', marginBottom: 10, textAlign: 'center'},
  step: { color: '#555', textAlign: 'center' }
});
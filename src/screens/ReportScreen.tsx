import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

const ReportScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [image, setImage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [contact, setContact] = useState(user?.email || '');
  const [status, setStatus] = useState<'perdido' | 'encontrado'>('perdido');
  const [loading, setLoading] = useState(false);

  // Selección de imagen
  const pickImage = async () => {
    const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permStatus !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tus fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) setImage(result.assets[0].uri);
  };

  // Validar y enviar reporte
  const handleSubmit = async () => {
    // Validación de campos
    if (!title.trim()) return Alert.alert('Error', 'Debes completar el título');
    if (!description.trim()) return Alert.alert('Error', 'Debes completar la descripción');
    if (!location.trim()) return Alert.alert('Error', 'Debes indicar la ubicación');
    if (!contact.trim()) return Alert.alert('Error', 'Debes indicar tus datos de contacto');
    if (!status) return Alert.alert('Error', 'Debes seleccionar el estado del objeto');

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('user_id', user?.id?.toString() || '0');
      formData.append('title', title);
      formData.append('description', description);
      formData.append('location', location);
      formData.append('contact', contact);
      formData.append('status', status);

      if (image) {
        const filename = image.split('/').pop()!;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;
        formData.append('image', { uri: image, name: filename, type } as any);
      }

      const res = await axios.post('http://localhost:3000/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('Éxito', res.data.message || 'Reporte enviado correctamente');

      // Limpiar formulario
      setTitle('');
      setDescription('');
      setLocation('');
      setContact(user?.email || '');
      setStatus('perdido');
      setImage(null);
    } catch (err: any) {
      console.error(err);
      Alert.alert(
        'Error',
        err.response?.data?.message || 'No se pudo enviar el reporte'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="bg-white px-4 py-3 flex-row items-center border-b border-gray-200">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-xl font-bold">Reportar un Objeto</Text>
        <View className="w-7" />
      </View>

      <View className="p-4">
        {/* Imagen */}
        <TouchableOpacity
          onPress={pickImage}
          className="bg-white rounded-3xl border-2 border-dashed border-gray-300 p-12 items-center justify-center mb-6"
        >
          {image ? (
            <Image
              source={{ uri: image }}
              className="w-full h-48 rounded-2xl"
              resizeMode="cover"
            />
          ) : (
            <>
              <Ionicons name="camera" size={64} color="#9ca3af" />
              <Text className="text-xl font-semibold text-gray-900 mt-4">
                Añadir una foto
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Estado del objeto */}
        <View className="mb-6">
          <Text className="text-base text-gray-600 font-medium mb-3">Estado del objeto</Text>
          <View className="flex-row space-x-4">
            {['perdido', 'encontrado'].map(s => (
              <TouchableOpacity
                key={s}
                onPress={() => setStatus(s as 'perdido' | 'encontrado')}
                className={`px-6 py-3 rounded-2xl border ${
                  status === s
                    ? s === 'perdido'
                      ? 'bg-red-400 border-red-500'
                      : 'bg-green-400 border-green-500'
                    : 'border-gray-300'
                }`}
              >
                <Text
                  className={
                    status === s ? 'text-white' : 'text-gray-700'
                  }
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Campos de texto */}
        {[
          { label: 'Título', value: title, setter: setTitle, placeholder: 'Ej: Llaves encontradas' },
          { label: 'Descripción', value: description, setter: setDescription, placeholder: 'Describe el objeto', multiline: true },
          { label: 'Ubicación', value: location, setter: setLocation, placeholder: 'Ej: Biblioteca, 2do piso' },
          { label: 'Contacto', value: contact, setter: setContact, placeholder: 'Tu email o número', keyboardType: 'email-address' },
        ].map((field, idx) => (
          <View className="mb-6" key={idx}>
            <Text className="text-base text-gray-600 font-medium mb-3">{field.label}</Text>
            <TextInput
              value={field.value}
              onChangeText={field.setter}
              placeholder={field.placeholder}
              placeholderTextColor="#9ca3af"
              multiline={field.multiline || false}
              numberOfLines={field.multiline ? 6 : 1}
              keyboardType={field.keyboardType as any}
              textAlignVertical={field.multiline ? 'top' : 'center'}
              className="bg-white rounded-2xl px-4 py-4 text-base text-gray-700"
            />
          </View>
        ))}

        {/* Botón enviar */}
        <TouchableOpacity
          onPress={handleSubmit}
          className={`rounded-full py-5 items-center mb-24 ${
            loading ? 'bg-gray-300' : 'bg-cyan-400'
          }`}
          disabled={loading}
        >
          <Text className="text-white text-lg font-bold">
            {loading ? 'Enviando...' : 'Enviar Reporte'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default ReportScreen;

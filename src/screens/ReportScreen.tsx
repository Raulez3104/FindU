import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { showMessage } from 'react-native-flash-message'; // ✅ Import para mensajes visuales

const ReportScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [image, setImage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [locationType, setLocationType] = useState<'biblioteca'|'aula'|'laboratorio'|'anfiteatro'|'cafeteria'|''>('');
  const [floor, setFloor] = useState<number | null>(null);
  const [classroom, setClassroom] = useState<string | null>(null);
  const [contact, setContact] = useState(user?.email || '');
  const [status, setStatus] = useState<'perdido' | 'encontrado'>('perdido');
  const [loading, setLoading] = useState(false);

  const isSubmitting = useRef(false);

  const pickImage = async () => {
    const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permStatus !== 'granted') {
      showMessage({
        message: 'Permiso denegado',
        description: 'Necesitamos acceso a tus fotos para continuar.',
        type: 'warning',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setLocationType('');
    setFloor(null);
    setClassroom(null);
    setContact(user?.email || '');
    setStatus('perdido');
    setImage(null);
  };

  const handleSubmit = async () => {
    // --- VALIDACIONES ---
    if (isSubmitting.current || loading) {
      showMessage({ message: 'Espera un momento', description: 'Ya hay un envío en proceso...', type: 'info' });
      return;
    }

    if (!title.trim() || !description.trim() || !location.trim() || !contact.trim()) {
      showMessage({ message: 'Campos incompletos', description: 'Por favor completa todos los campos antes de enviar.', type: 'danger' });
      return;
    }

    isSubmitting.current = true;
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
        if (Platform.OS === 'web') {
          const response = await fetch(image);
          const blob = await response.blob();
          const filename = `image-${Date.now()}.jpg`;
          formData.append('image', blob, filename);
        } else {
          const filename = image.split('/').pop()!;
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;
          formData.append('image', { uri: image, name: filename, type } as any);
        }
      }

      const res = await axios.post('http://localhost:3000/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 15000,
      });

      isSubmitting.current = false;
      setLoading(false);

      showMessage({ message: '¡Éxito!', description: res.data.message || 'Reporte enviado correctamente.', type: 'success' });

      resetForm();
      navigation.goBack();
    } catch (err: any) {
      console.error('❌ Error completo:', err);
      isSubmitting.current = false;
      setLoading(false);

      let errorMessage = 'No se pudo enviar el reporte';
      if (err.response) {
        errorMessage = err.response.data?.message || `Error del servidor (${err.response.status})`;
      } else if (err.request) {
        errorMessage = 'No se pudo conectar con el servidor. Verifica la conexión.';
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'La solicitud tardó demasiado. Intenta nuevamente.';
      }

      showMessage({ message: 'Error', description: errorMessage, type: 'danger' });
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
        <TouchableOpacity
          onPress={pickImage}
          disabled={loading}
          className="bg-white rounded-3xl border-2 border-dashed border-gray-300 p-12 items-center justify-center mb-6"
        >
          {image ? (
            <Image source={{ uri: image }} className="w-full h-48 rounded-2xl" resizeMode="cover" />
          ) : (
            <>
              <Ionicons name="camera" size={64} color="#9ca3af" />
              <Text className="text-xl font-semibold text-gray-900 mt-4">Añadir una foto</Text>
            </>
          )}
        </TouchableOpacity>

        <View className="mb-6">
          <Text className="text-base text-gray-600 font-medium mb-3">Estado del objeto</Text>
          <View className="flex-row space-x-4">
            {['perdido', 'encontrado'].map(s => (
              <TouchableOpacity
                key={s}
                onPress={() => setStatus(s as 'perdido' | 'encontrado')}
                disabled={loading}
                className={`px-6 py-3 rounded-2xl border ${
                  status === s
                    ? s === 'perdido'
                      ? 'bg-red-400 border-red-500'
                      : 'bg-green-400 border-green-500'
                    : 'border-gray-300'
                } ${loading ? 'opacity-50' : ''}`}
              >
                <Text className={status === s ? 'text-white font-semibold' : 'text-gray-700'}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Título */}
        <View className="mb-6">
          <Text className="text-base text-gray-600 font-medium mb-3">Título</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={'Ej: Llaves encontradas'}
            placeholderTextColor="#9ca3af"
            editable={!loading}
            className={`bg-white rounded-2xl px-4 py-4 text-base text-gray-700 border border-gray-200 ${loading ? 'opacity-50' : ''}`}
          />
        </View>

        {/* Descripción */}
        <View className="mb-6">
          <Text className="text-base text-gray-600 font-medium mb-3">Descripción</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={'Describe el objeto'}
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={6}
            textAlignVertical={'top'}
            editable={!loading}
            className={`bg-white rounded-2xl px-4 py-4 text-base text-gray-700 border border-gray-200 ${loading ? 'opacity-50' : ''}`}
          />
        </View>

        {/* Ubicación: opciones predefinidas */}
        <View className="mb-6">
          <Text className="text-base text-gray-600 font-medium mb-3">Ubicación</Text>
          <View className="flex-row flex-wrap">
            {[
              { key: 'biblioteca', label: 'Biblioteca' },
              { key: 'aula', label: 'Aula' },
              { key: 'laboratorio', label: 'Laboratorio' },
              { key: 'anfiteatro', label: 'Anfiteatro' },
              { key: 'cafeteria', label: 'Cafetería' },
            ].map(opt => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  const k = opt.key as any;
                  setLocationType(k);
                  if (k !== 'aula') {
                    setLocation(opt.label);
                    setFloor(null);
                    setClassroom(null);
                  } else {
                    setLocation('');
                    setFloor(null);
                    setClassroom(null);
                  }
                }}
                disabled={loading}
                className={`px-4 py-2 mr-2 mb-2 rounded-2xl border ${locationType === opt.key ? 'bg-[#fb8500] border-[#fb8500]' : 'border-gray-300 bg-white'}`}
              >
                <Text className={locationType === opt.key ? 'text-white' : 'text-gray-700'}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {locationType === 'aula' && (
            <View className="mt-4">
              <Text className="text-sm text-gray-600 mb-2">Selecciona el piso</Text>
              <View className="flex-row mb-3">
                {[1,2,3,4].map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => {
                      setFloor(p);
                      setClassroom(null);
                      setLocation('');
                    }}
                    className={`px-4 py-2 mr-2 rounded-2xl border ${floor === p ? 'bg-[#fb8500] border-[#fb8500]' : 'border-gray-300 bg-white'}`}
                  >
                    <Text className={floor === p ? 'text-white' : 'text-gray-700'}>Piso {p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {floor && (
                <View>
                  <Text className="text-sm text-gray-600 mb-2">Selecciona el número de aula</Text>
                  <View className="flex-row flex-wrap">
                    {(() => {
                      let start = 101, end = 112;
                      if (floor === 1) { start = 101; end = 112; }
                      if (floor === 2) { start = 201; end = 210; }
                      if (floor === 3) { start = 301; end = 312; }
                      if (floor === 4) { start = 401; end = 412; }
                      const items = [] as number[];
                      for (let n = start; n <= end; n++) items.push(n);
                      return items.map(n => (
                        <TouchableOpacity
                          key={n}
                          onPress={() => {
                            setClassroom(String(n));
                            setLocation(`Aula ${n}`);
                          }}
                          className={`px-3 py-2 mr-2 mb-2 rounded-2xl border ${classroom === String(n) ? 'bg-[#fb8500] border-[#fb8500]' : 'border-gray-300 bg-white'}`}
                        >
                          <Text className={classroom === String(n) ? 'text-white' : 'text-gray-700'}>{n}</Text>
                        </TouchableOpacity>
                      ));
                    })()}
                  </View>
                </View>
              )}
            </View>
          )}

          {location ? (
            <Text className="text-sm text-gray-500 mt-2">Seleccionado: {location}</Text>
          ) : (
            <Text className="text-sm text-gray-400 mt-2">Selecciona una ubicación</Text>
          )}
        </View>

        {/* Contacto */}
        <View className="mb-6">
          <Text className="text-base text-gray-600 font-medium mb-3">Contacto</Text>
          <TextInput
            value={contact}
            onChangeText={setContact}
            placeholder={'Tu email o número'}
            placeholderTextColor="#9ca3af"
            keyboardType={'email-address'}
            editable={!loading}
            className={`bg-white rounded-2xl px-4 py-4 text-base text-gray-700 border border-gray-200 ${loading ? 'opacity-50' : ''}`}
          />
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          activeOpacity={0.7}
          className={`rounded-full py-5 items-center mb-24 ${
            loading ? 'bg-gray-400' : 'bg-[#fb8500]'
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

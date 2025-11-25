import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, TouchableOpacity, Alert, Share, Linking, Modal } from 'react-native';
import axios from 'axios';
// navigation props are handled dynamically; use any for compatibility
import { Ionicons } from '@expo/vector-icons';

const ItemDetailsScreen: React.FC<any> = ({ route, navigation }) => {
  const { id, preview } = (route && route.params) || {};
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(preview || null);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchDetails = async () => {
      try {
        const res = await axios.get(`http://localhost:3000/reports/${id}`);
        if (!mounted) return;
        setData(res.data.report || res.data);
      } catch (e) {
        console.error('Error fetching details', e);
        // keep preview if any
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (!preview) fetchDetails();
    else setLoading(false);

    return () => { mounted = false; };
  }, [id, preview]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${data?.title || data?.name} - ${data?.location || ''}`,
      });
    } catch (e) {
      console.error('Share error', e);
    }
  };

  const handleContact = () => {
    const contact = data?.contact || data?.email;
    if (!contact) {
      Alert.alert('Contacto no disponible');
      return;
    }
    // intentar abrir mailto
    const mailUrl = `mailto:${contact}`;
    Linking.canOpenURL(mailUrl).then(supported => {
      if (supported) Linking.openURL(mailUrl);
      else Alert.alert('No se puede abrir el cliente de correo');
    });
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#fb8500" />
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text className="text-lg text-gray-700">No se encontraron detalles para este reporte.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-4 pt-6 pb-8">
        <View className="flex-row items-center justify-start">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        <View className="mt-4 bg-white rounded-2xl shadow-md overflow-hidden">
          {(() => {
            const uri = data.imageUrl || data.image || data.image_url || null;
            if (uri) {
              return (
                <TouchableOpacity onPress={() => setShowImageModal(true)} activeOpacity={0.9}>
                  <Image
                    source={{ uri }}
                    style={{ width: '100%', height: 220, backgroundColor: '#f3f4f6' }}
                    resizeMode="contain"
                    accessibilityLabel={data.title || data.name}
                  />
                </TouchableOpacity>
              );
            }
            return (
              <View className="w-full h-64 bg-gray-100 items-center justify-center">
                <Ionicons name="image" size={48} color="#9CA3AF" />
              </View>
            );
          })()}

          {/* Modal para ver imagen completa */}
          <Modal visible={showImageModal} transparent={false} onRequestClose={() => setShowImageModal(false)}>
            <View className="flex-1 bg-black">
              <View className="p-4 flex-row justify-end">
                <TouchableOpacity onPress={() => setShowImageModal(false)} className="p-2">
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
              {(() => {
                const uri = data.imageUrl || data.image || data.image_url || null;
                return uri ? (
                  <Image source={{ uri }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />
                ) : null;
              })()}
            </View>
          </Modal>

          <View className="p-5">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-2xl font-semibold text-gray-900">{data.title || data.name}</Text>
                <Text className="mt-2 text-sm text-gray-500">{data.location || 'Ubicación desconocida'}</Text>
              </View>

              <View className="items-end">
                <View className={`px-3 py-1 rounded-full ${data.status && data.status.toLowerCase().includes('perdido') ? 'bg-red-100' : 'bg-green-100'}`}>
                  <Text className={`${data.status && data.status.toLowerCase().includes('perdido') ? 'text-red-600' : 'text-green-600'} text-sm font-semibold`}>{data.status || ''}</Text>
                </View>
              </View>
            </View>

            {data.description ? (
              <View className="mt-4">
                <Text className="text-base text-gray-700 leading-7">{data.description}</Text>
              </View>
            ) : null}

            <View className="mt-6 border-t border-gray-100 pt-4">
              <Text className="text-sm text-gray-500">Información</Text>
              <View className="mt-2">
                <Text className="text-sm text-gray-700">ID: <Text className="font-medium text-gray-900">{data.id}</Text></Text>
                {data.date && (
                  <Text className="text-sm text-gray-700 mt-1">Fecha: <Text className="font-medium text-gray-900">{new Date(data.date).toLocaleString()}</Text></Text>
                )}
                {data.contact && (
                  <Text className="text-sm text-gray-700 mt-1">Contacto: <Text className="font-medium text-gray-900">{data.contact}</Text></Text>
                )}
              </View>
            </View>

            <View className="mt-6 flex-row space-x-3">
              <TouchableOpacity onPress={handleContact} className="flex-1 flex-row items-center justify-center space-x-2 border border-gray-200 rounded-2xl py-3">
                <Ionicons name="mail" size={18} color="#065f46" />
                <Text className="text-green-700 font-semibold">Contactar</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleShare} className="flex-1 flex-row items-center justify-center space-x-2 bg-[#fb8500] rounded-2xl py-3">
                <Ionicons name="share-social" size={18} color="#fff" />
                <Text className="text-white font-semibold">Compartir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default ItemDetailsScreen;

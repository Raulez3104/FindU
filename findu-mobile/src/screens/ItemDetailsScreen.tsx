import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { esReporteNoEncontrado, obtenerReporte, type Reporte } from '@/services/reportService';
import { formatearFechaHoraVisible, formatearFechaVisible } from '@/utils/calendar';

const ItemDetailsScreen: React.FC<any> = ({ route, navigation }) => {
  const { id } = (route && route.params) || {};
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Reporte | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  const cargarReporte = useCallback(async () => {
    if (id === undefined || id === null) {
      setNoEncontrado(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNoEncontrado(false);
    setError(null);
    try {
      const reporte = await obtenerReporte(Number(id));
      setData(reporte);
    } catch (fallo) {
      console.error('Error al obtener el reporte:', fallo);
      if (esReporteNoEncontrado(fallo)) {
        setNoEncontrado(true);
      } else {
        setError('No se pudo cargar el reporte. Revisa tu conexión.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void cargarReporte();
  }, [cargarReporte]);

  const ubicacion = data ? data.ubicacion_nombre || data.ubicacion_otro || 'Sin ubicación' : '';

  const handleShare = async () => {
    if (!data) {
      return;
    }
    try {
      await Share.share({
        message: `${data.titulo} - ${ubicacion} - ${data.estado}`,
      });
    } catch (fallo) {
      console.error('Error al compartir:', fallo);
    }
  };

  const handleContact = () => {
    if (!data?.contacto) {
      Alert.alert('Contacto no disponible');
      return;
    }
    const mailUrl = `mailto:${data.contacto}`;
    Linking.canOpenURL(mailUrl).then((soportado) => {
      if (soportado) {
        void Linking.openURL(mailUrl);
      } else {
        Alert.alert('No se puede abrir el cliente de correo');
      }
    });
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#fb8500" />
      </View>
    );
  }

  if (noEncontrado) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Ionicons name="search-outline" size={48} color="#9CA3AF" />
        <Text className="mt-4 text-lg font-semibold text-gray-800">Reporte no encontrado</Text>
        <Text className="mt-2 text-center text-gray-500">
          El reporte no existe o ya no está disponible.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mt-6 rounded-xl bg-[#fb8500] px-6 py-3">
          <Text className="font-semibold text-white">Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Ionicons name="cloud-offline-outline" size={48} color="#9CA3AF" />
        <Text className="mt-4 text-center text-gray-700">
          {error ?? 'No se encontraron detalles para este reporte.'}
        </Text>
        <TouchableOpacity
          onPress={() => void cargarReporte()}
          className="mt-6 rounded-xl bg-[#fb8500] px-6 py-3">
          <Text className="font-semibold text-white">Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-4 pb-8 pt-6">
        <View className="flex-row items-center justify-start">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        <View className="mt-4 overflow-hidden rounded-2xl bg-white shadow-md">
          {data.imageUrl ? (
            <TouchableOpacity onPress={() => setShowImageModal(true)} activeOpacity={0.9}>
              <Image
                source={{ uri: data.imageUrl }}
                style={{
                  width: '100%',
                  height: 220,
                  backgroundColor: '#f3f4f6',
                }}
                resizeMode="contain"
                accessibilityLabel={data.titulo}
              />
            </TouchableOpacity>
          ) : (
            <View className="h-64 w-full items-center justify-center bg-gray-100">
              <Ionicons name="image" size={48} color="#9CA3AF" />
            </View>
          )}

          <Modal
            visible={showImageModal}
            transparent={false}
            onRequestClose={() => setShowImageModal(false)}>
            <View className="flex-1 bg-black">
              <View className="flex-row justify-end p-4">
                <TouchableOpacity onPress={() => setShowImageModal(false)} className="p-2">
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
              {data.imageUrl ? (
                <Image
                  source={{ uri: data.imageUrl }}
                  style={{ width: '100%', height: '80%' }}
                  resizeMode="contain"
                />
              ) : null}
            </View>
          </Modal>

          <View className="p-5">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-2xl font-semibold text-gray-900">{data.titulo}</Text>
                <Text className="mt-2 text-sm text-gray-500">{ubicacion}</Text>
              </View>

              <View className="items-end">
                <View
                  className={`rounded-full px-3 py-1 ${
                    data.tipo_reporte === 'perdido' ? 'bg-red-100' : 'bg-green-100'
                  }`}>
                  <Text
                    className={`text-sm font-semibold capitalize ${
                      data.tipo_reporte === 'perdido' ? 'text-red-600' : 'text-green-700'
                    }`}>
                    {data.tipo_reporte}
                  </Text>
                </View>
                <View className="mt-2 rounded-full bg-gray-100 px-3 py-1">
                  <Text className="text-sm font-semibold text-gray-700">{data.estado}</Text>
                </View>
              </View>
            </View>

            {data.descripcion ? (
              <View className="mt-4">
                <Text className="text-base leading-7 text-gray-700">{data.descripcion}</Text>
              </View>
            ) : null}

            <View className="mt-6 border-t border-gray-100 pt-4">
              <Text className="text-sm text-gray-500">Información</Text>
              <View className="mt-2">
                <Text className="mt-1 text-sm text-gray-700">
                  Categoría:{' '}
                  <Text className="font-medium text-gray-900">{data.categoria_nombre}</Text>
                </Text>
                <Text className="mt-1 text-sm text-gray-700">
                  Fecha del incidente:{' '}
                  <Text className="font-medium text-gray-900">
                    {formatearFechaVisible(data.fecha_incidente)}
                  </Text>
                </Text>
                <Text className="mt-1 text-sm text-gray-700">
                  Publicado:{' '}
                  <Text className="font-medium text-gray-900">
                    {formatearFechaHoraVisible(data.fecha)}
                  </Text>
                </Text>
                <Text className="mt-1 text-sm text-gray-700">
                  Campus: <Text className="font-medium text-gray-900">{data.campus}</Text>
                </Text>
                <Text className="mt-1 text-sm text-gray-700">
                  Ubicación: <Text className="font-medium text-gray-900">{ubicacion}</Text>
                </Text>
                {(data.administrador_nombre || data.usuario_nombre) && (
                  <Text className="mt-1 text-sm text-gray-700">
                    Publicado por:{' '}
                    <Text className="font-medium text-gray-900">
                      {data.administrador_nombre || data.usuario_nombre}
                    </Text>
                  </Text>
                )}
                <Text className="mt-1 text-sm text-gray-700">
                  ID: <Text className="font-medium text-gray-900">{data.id}</Text>
                </Text>
                {data.contacto ? (
                  <Text className="mt-1 text-sm text-gray-700">
                    Contacto: <Text className="font-medium text-gray-900">{data.contacto}</Text>
                  </Text>
                ) : null}
              </View>
            </View>

            <View className="mt-6 flex-row space-x-3">
              <TouchableOpacity
                onPress={handleContact}
                className="flex-1 flex-row items-center justify-center space-x-2 rounded-2xl border border-gray-200 py-3">
                <Ionicons name="mail" size={18} color="#065f46" />
                <Text className="font-semibold text-green-700">Contactar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShare}
                className="flex-1 flex-row items-center justify-center space-x-2 rounded-2xl bg-[#fb8500] py-3">
                <Ionicons name="share-social" size={18} color="#fff" />
                <Text className="font-semibold text-white">Compartir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default ItemDetailsScreen;

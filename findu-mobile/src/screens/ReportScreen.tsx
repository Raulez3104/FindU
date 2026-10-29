import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { showMessage } from 'react-native-flash-message';
import { useAuth } from '@/context/AuthContext';
import DatePickerField from '@/components/DatePickerField';
import {
  obtenerCategorias,
  obtenerUbicaciones,
  type Categoria,
  type Ubicacion,
} from '@/services/catalogService';
import {
  crearReporte,
  obtenerMensajeErrorReporte,
  type ImagenReporte,
} from '@/services/reportService';
import { fechaLocalHoy, validarFormularioReporte, type ImagenFormulario } from '@/utils/reportForm';

interface ImagenSeleccionada extends ImagenFormulario {
  uri: string;
}

const ReportScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<'perdido' | 'encontrado'>('perdido');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [fecha, setFecha] = useState(fechaLocalHoy());
  const [campus, setCampus] = useState('principal');
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [ubicacionId, setUbicacionId] = useState<number | null>(null);
  const [usarOtraUbicacion, setUsarOtraUbicacion] = useState(false);
  const [ubicacionOtra, setUbicacionOtra] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [contacto, setContacto] = useState(user?.correo ?? '');
  const [imagen, setImagen] = useState<ImagenSeleccionada | null>(null);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [cargandoUbicaciones, setCargandoUbicaciones] = useState(false);
  const [loading, setLoading] = useState(false);
  const guardando = useRef(false);

  useEffect(() => {
    let activo = true;

    obtenerCategorias()
      .then((lista) => {
        if (activo) {
          setCategorias(lista);
        }
      })
      .catch((error) => {
        console.error('Error al cargar categorías:', error);
        if (activo) {
          showMessage({
            message: 'No se pudieron cargar las categorías',
            description: 'Revisa tu conexión e intenta de nuevo.',
            type: 'danger',
          });
        }
      })
      .finally(() => {
        if (activo) {
          setCargandoCatalogos(false);
        }
      });

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    const campusLimpio = campus.trim();
    if (!campusLimpio) {
      setUbicaciones([]);
      setUbicacionId(null);
      return;
    }

    let activo = true;
    const temporizador = setTimeout(() => {
      setCargandoUbicaciones(true);
      obtenerUbicaciones(campusLimpio)
        .then((lista) => {
          if (activo) {
            setUbicaciones(lista);
            setUbicacionId(null);
            setUsarOtraUbicacion(false);
          }
        })
        .catch((error) => {
          console.error('Error al cargar ubicaciones:', error);
          if (activo) {
            setUbicaciones([]);
            showMessage({
              message: 'No se pudieron cargar las ubicaciones',
              description: 'Revisa el campus o tu conexión.',
              type: 'danger',
            });
          }
        })
        .finally(() => {
          if (activo) {
            setCargandoUbicaciones(false);
          }
        });
    }, 400);

    return () => {
      activo = false;
      clearTimeout(temporizador);
    };
  }, [campus]);

  const seleccionarImagen = async (origen: 'camara' | 'galeria') => {
    try {
      if (origen === 'camara') {
        const permiso = await ImagePicker.requestCameraPermissionsAsync();
        if (!permiso.granted) {
          showMessage({
            message: 'Permiso denegado',
            description: 'Necesitamos acceso a la cámara para continuar.',
            type: 'warning',
          });
          return;
        }
      } else {
        const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permiso.granted) {
          showMessage({
            message: 'Permiso denegado',
            description: 'Necesitamos acceso a tus fotos para continuar.',
            type: 'warning',
          });
          return;
        }
      }

      const resultado =
        origen === 'camara'
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              quality: 0.7,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.7,
            });

      if (resultado.canceled) {
        return;
      }

      const asset = resultado.assets[0];
      if (!asset) {
        return;
      }

      const nombre = asset.fileName ?? `reporte-${Date.now()}.jpg`;
      const tipoImagen =
        asset.mimeType ?? (nombre.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
      let tamanoBytes = asset.fileSize ?? null;
      if (tamanoBytes === null) {
        const respuesta = await fetch(asset.uri);
        tamanoBytes = (await respuesta.blob()).size;
      }

      setImagen({
        uri: asset.uri,
        nombre,
        tipo: tipoImagen,
        tamanoBytes,
      });
    } catch (error) {
      console.error('Error al seleccionar la imagen:', error);
      showMessage({
        message: 'No se pudo abrir la imagen',
        description: 'Intenta de nuevo con otra foto.',
        type: 'danger',
      });
    }
  };

  const restablecerFormulario = () => {
    setTipo('perdido');
    setCategoriaId(null);
    setFecha(fechaLocalHoy());
    setCampus('principal');
    setUbicacionId(null);
    setUsarOtraUbicacion(false);
    setUbicacionOtra('');
    setTitulo('');
    setDescripcion('');
    setContacto(user?.correo ?? '');
    setImagen(null);
  };

  const handleSubmit = async () => {
    if (guardando.current || loading) {
      return;
    }

    const validacion = validarFormularioReporte({
      tipo_reporte: tipo,
      categoria_id: categoriaId,
      fecha_incidente: fecha,
      campus,
      ubicacion_id: usarOtraUbicacion ? null : ubicacionId,
      ubicacion_otro: usarOtraUbicacion ? ubicacionOtra : '',
      titulo,
      descripcion,
      contacto,
      imagen: imagen
        ? {
            nombre: imagen.nombre,
            tipo: imagen.tipo,
            tamanoBytes: imagen.tamanoBytes,
          }
        : null,
    });

    if (!validacion.valido) {
      showMessage({
        message: 'Revisa el formulario',
        description: validacion.mensaje,
        type: 'danger',
      });
      return;
    }

    guardando.current = true;
    setLoading(true);

    try {
      const imagenParaServicio: ImagenReporte | undefined = imagen
        ? { uri: imagen.uri, nombre: imagen.nombre, tipo: imagen.tipo }
        : undefined;
      await crearReporte(validacion.datos, imagenParaServicio);
      showMessage({
        message: 'Reporte enviado',
        description: 'Tu reporte se guardó correctamente.',
        type: 'success',
      });
      restablecerFormulario();
      navigation.navigate('Profile');
    } catch (error) {
      console.error('Error al guardar el reporte:', error);
      showMessage({
        message: 'No se pudo enviar',
        description: obtenerMensajeErrorReporte(error),
        type: 'danger',
      });
    } finally {
      guardando.current = false;
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-28"
        keyboardShouldPersistTaps="handled">
        <View className="border-b border-gray-200 bg-white px-4 py-4">
          <Text className="text-center text-xl font-bold">Reportar objeto</Text>
          <Text className="mt-1 text-center text-sm text-gray-500">
            Completa los datos para publicar el reporte.
          </Text>
        </View>

        <View className="px-4 py-5">
          <Text className="mb-2 text-sm font-semibold text-gray-700">Tipo</Text>
          <View className="flex-row rounded-xl bg-gray-200 p-1">
            {(['perdido', 'encontrado'] as const).map((opcion) => {
              const activo = tipo === opcion;
              return (
                <TouchableOpacity
                  key={opcion}
                  onPress={() => setTipo(opcion)}
                  className={`flex-1 rounded-lg py-2 ${activo ? 'bg-white' : ''}`}>
                  <Text
                    className={`text-center font-semibold capitalize ${
                      activo ? 'text-[#fb8500]' : 'text-gray-500'
                    }`}>
                    {opcion}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text className="mb-2 mt-5 text-sm font-semibold text-gray-700">Categoría</Text>
          <View className="overflow-hidden rounded-xl border border-gray-300 bg-white">
            {cargandoCatalogos ? (
              <View className="flex-row items-center px-4 py-3">
                <ActivityIndicator color="#fb8500" />
                <Text className="ml-3 text-gray-500">Cargando categorías...</Text>
              </View>
            ) : (
              <Picker
                selectedValue={categoriaId ?? 0}
                onValueChange={(valor) => {
                  const numero = Number(valor);
                  setCategoriaId(numero > 0 ? numero : null);
                }}>
                <Picker.Item label="Selecciona una categoría" value={0} />
                {categorias.map((categoria) => (
                  <Picker.Item key={categoria.id} label={categoria.nombre} value={categoria.id} />
                ))}
              </Picker>
            )}
          </View>

          <Text className="mb-2 mt-5 text-sm font-semibold text-gray-700">Fecha del incidente</Text>
          <DatePickerField value={fecha} onChange={setFecha} />

          <Text className="mb-2 mt-5 text-sm font-semibold text-gray-700">Campus</Text>
          <View className="overflow-hidden rounded-xl border border-gray-300 bg-gray-100">
            <Picker
              enabled={false}
              selectedValue={campus}
              onValueChange={() => {}}
              accessibilityLabel="Campus Principal, no editable">
              <Picker.Item label="Principal" value="principal" />
            </Picker>
          </View>
          <Text className="mt-1 text-xs text-gray-500">Campus único disponible.</Text>

          <Text className="mb-2 mt-5 text-sm font-semibold text-gray-700">Ubicación</Text>
          <View className="overflow-hidden rounded-xl border border-gray-300 bg-white">
            {cargandoUbicaciones ? (
              <View className="flex-row items-center px-4 py-3">
                <ActivityIndicator color="#fb8500" />
                <Text className="ml-3 text-gray-500">Cargando ubicaciones...</Text>
              </View>
            ) : (
              <Picker
                selectedValue={usarOtraUbicacion ? -1 : (ubicacionId ?? 0)}
                onValueChange={(valor) => {
                  const numero = Number(valor);
                  if (numero === -1) {
                    setUsarOtraUbicacion(true);
                    setUbicacionId(null);
                    return;
                  }
                  setUsarOtraUbicacion(false);
                  setUbicacionId(numero > 0 ? numero : null);
                }}>
                <Picker.Item label="Selecciona una ubicación" value={0} />
                {ubicaciones.map((ubicacion) => (
                  <Picker.Item key={ubicacion.id} label={ubicacion.nombre} value={ubicacion.id} />
                ))}
                <Picker.Item label="Otro (especificar)" value={-1} />
              </Picker>
            )}
          </View>

          {usarOtraUbicacion && (
            <TextInput
              value={ubicacionOtra}
              onChangeText={setUbicacionOtra}
              placeholder="Escribe la ubicación"
              maxLength={255}
              className="mt-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900"
            />
          )}

          <Text className="mb-2 mt-5 text-sm font-semibold text-gray-700">Título</Text>
          <TextInput
            value={titulo}
            onChangeText={setTitulo}
            placeholder="Ej. Mochila azul"
            maxLength={255}
            className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900"
          />

          <Text className="mb-2 mt-5 text-sm font-semibold text-gray-700">Descripción</Text>
          <TextInput
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Describe el objeto y las circunstancias"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="min-h-[110px] rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900"
          />

          <Text className="mb-2 mt-5 text-sm font-semibold text-gray-700">Contacto</Text>
          <TextInput
            value={contacto}
            onChangeText={setContacto}
            placeholder="Correo o teléfono de contacto"
            autoCapitalize="none"
            maxLength={255}
            className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900"
          />

          <Text className="mb-2 mt-5 text-sm font-semibold text-gray-700">Fotografía</Text>
          {imagen ? (
            <View className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <Image source={{ uri: imagen.uri }} className="h-48 w-full" resizeMode="cover" />
              <TouchableOpacity
                onPress={() => setImagen(null)}
                className="flex-row items-center justify-center py-3">
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                <Text className="ml-2 font-semibold text-red-500">Quitar foto</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row">
              {Platform.OS !== 'web' && (
                <TouchableOpacity
                  onPress={() => seleccionarImagen('camara')}
                  className="mr-2 flex-1 flex-row items-center justify-center rounded-xl border border-gray-300 bg-white py-3">
                  <Ionicons name="camera-outline" size={20} color="#fb8500" />
                  <Text className="ml-2 font-semibold text-gray-700">Cámara</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => seleccionarImagen('galeria')}
                className="flex-1 flex-row items-center justify-center rounded-xl border border-gray-300 bg-white py-3">
                <Ionicons name="images-outline" size={20} color="#fb8500" />
                <Text className="ml-2 font-semibold text-gray-700">Galería</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className={`mt-7 flex-row items-center justify-center rounded-xl py-4 ${
              loading ? 'bg-orange-300' : 'bg-[#fb8500]'
            }`}>
            {loading ? (
              <>
                <ActivityIndicator color="white" />
                <Text className="ml-3 text-base font-semibold text-white">Enviando...</Text>
              </>
            ) : (
              <Text className="text-base font-semibold text-white">Publicar reporte</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ReportScreen;

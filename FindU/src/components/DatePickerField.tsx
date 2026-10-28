import React, { useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fechaLocalHoy } from '@/utils/reportForm';
import {
  DIAS_SEMANA,
  MESES,
  celdasDelMes,
  fechaISO,
  formatearFechaVisible,
  partesFecha,
} from '@/utils/calendar';

interface DatePickerFieldProps {
  value: string;
  onChange: (fecha: string) => void;
}

export default function DatePickerField({ value, onChange }: DatePickerFieldProps) {
  const maximo = fechaLocalHoy();
  const partesValor = partesFecha(value) ?? partesFecha(maximo);
  const inicial = partesValor ?? { anio: new Date().getFullYear(), mes: 1, dia: 1 };
  const [abierto, setAbierto] = useState(false);
  const [visible, setVisible] = useState({ anio: inicial.anio, mes: inicial.mes });

  const abrir = () => {
    const partes = partesFecha(value) ?? partesFecha(maximo);
    if (partes) {
      setVisible({ anio: partes.anio, mes: partes.mes });
    }
    setAbierto(true);
  };

  const cambiarMes = (delta: number) => {
    setVisible((actual) => {
      let mes = actual.mes + delta;
      let anio = actual.anio;
      if (mes < 1) {
        mes = 12;
        anio -= 1;
      } else if (mes > 12) {
        mes = 1;
        anio += 1;
      }
      return { anio, mes };
    });
  };

  const partesMaximo = partesFecha(maximo);
  const puedeAvanzar =
    Boolean(partesMaximo) &&
    (visible.anio < partesMaximo!.anio ||
      (visible.anio === partesMaximo!.anio && visible.mes < partesMaximo!.mes));

  const seleccionar = (dia: number) => {
    const fecha = fechaISO(visible.anio, visible.mes, dia);
    if (fecha > maximo) {
      return;
    }
    onChange(fecha);
    setAbierto(false);
  };

  const seleccionarHoy = () => {
    onChange(maximo);
    setAbierto(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={abrir}
        accessibilityRole="button"
        accessibilityLabel={`Fecha del incidente: ${formatearFechaVisible(value)}`}
        className="flex-row items-center justify-between rounded-xl border border-gray-300 bg-white px-4 py-3">
        <Text className="text-base text-gray-900">{formatearFechaVisible(value)}</Text>
        <Ionicons name="calendar-outline" size={20} color="#fb8500" />
      </TouchableOpacity>

      <Modal
        visible={abierto}
        transparent
        animationType="fade"
        onRequestClose={() => setAbierto(false)}>
        <View className="flex-1 items-center justify-center bg-black/50 px-4">
          <View className="w-full max-w-md rounded-2xl bg-white p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => cambiarMes(-1)}
                accessibilityRole="button"
                accessibilityLabel="Mes anterior"
                className="h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                <Ionicons name="chevron-back" size={22} color="#374151" />
              </TouchableOpacity>

              <Text className="text-lg font-bold capitalize text-gray-900">
                {MESES[visible.mes - 1]} {visible.anio}
              </Text>

              <TouchableOpacity
                onPress={() => cambiarMes(1)}
                disabled={!puedeAvanzar}
                accessibilityRole="button"
                accessibilityLabel="Mes siguiente"
                className={`h-10 w-10 items-center justify-center rounded-full ${
                  puedeAvanzar ? 'bg-gray-100' : 'bg-gray-50'
                }`}>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={puedeAvanzar ? '#374151' : '#d1d5db'}
                />
              </TouchableOpacity>
            </View>

            <View className="flex-row">
              {DIAS_SEMANA.map((dia) => (
                <Text
                  key={dia}
                  style={{ width: '14.2857%' }}
                  className="text-center text-xs font-semibold text-gray-500">
                  {dia}
                </Text>
              ))}
            </View>

            <View className="mt-2 flex-row flex-wrap">
              {celdasDelMes(visible.anio, visible.mes).map((dia, indice) => {
                if (dia === null) {
                  return <View key={`vacio-${indice}`} style={{ width: '14.2857%' }} />;
                }

                const fecha = fechaISO(visible.anio, visible.mes, dia);
                const esFutura = fecha > maximo;
                const esSeleccionada = fecha === value;
                const esHoy = fecha === maximo;

                return (
                  <View key={fecha} style={{ width: '14.2857%' }} className="items-center py-1">
                    <TouchableOpacity
                      onPress={() => seleccionar(dia)}
                      disabled={esFutura}
                      accessibilityRole="button"
                      accessibilityLabel={`${dia} de ${MESES[visible.mes - 1]} de ${visible.anio}`}
                      className={`h-9 w-9 items-center justify-center rounded-full ${
                        esSeleccionada ? 'bg-[#fb8500]' : esHoy ? 'border border-[#fb8500]' : ''
                      }`}>
                      <Text
                        className={`text-sm ${
                          esSeleccionada
                            ? 'font-bold text-white'
                            : esFutura
                              ? 'text-gray-300'
                              : 'text-gray-800'
                        }`}>
                        {dia}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <View className="mt-4 flex-row items-center justify-between border-t border-gray-100 pt-4">
              <TouchableOpacity
                onPress={seleccionarHoy}
                accessibilityRole="button"
                className="rounded-lg bg-orange-100 px-3 py-2">
                <Text className="font-semibold text-[#fb8500]">Hoy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAbierto(false)}
                accessibilityRole="button"
                className="rounded-lg px-3 py-2">
                <Text className="font-semibold text-gray-600">Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

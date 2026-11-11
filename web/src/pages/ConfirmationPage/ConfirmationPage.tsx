

import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';

import { orderById, useApiQuery } from '~/api';
import type { Order } from '~/types';
import { formatUsd } from '~/lib/money';
import { swal } from '~/utils/swal';




export function ConfirmationPage() {
  const { orderId = '' } = useParams();
  const alertShown = useRef(false);




  const {
    data: order,
    isPending,
    isError,
    refetch,
  } = useApiQuery<Order>(
    orderById,
    { id: orderId },
    { enabled: Boolean(orderId) },
  );   


  // Mostrar confirmación de compra una sola vez
  useEffect(() => {
    if (!isPending && order && !isError && !alertShown.current) {
      alertShown.current = true;

      void swal.fire({
        icon: 'success',
        title: '¡Compra procesada con exito!',        
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    }
  }, [order, isPending, isError]);

  if (!orderId) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">
          Orden no encontrada
        </h1>
        <Link to="/" className="mt-6 inline-block text-accent">
          Volver a eventos
        </Link>
      </main>
    );
  }

  if (isPending) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-ink/70">
          Cargando los datos de tu compra...
        </p>
      </main>
    );
  }

  if (isError || !order) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">
          No pudimos cargar tu orden
        </h1>

        <p className="mt-3 text-sm text-ink/70">
          Verifica el identificador o intenta nuevamente.
        </p>

        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-6 rounded-xl bg-accent px-5 py-3 font-semibold text-white"
        >
          Reintentar
        </button>

        <div>
          <Link to="/" className="mt-6 inline-block text-accent">
            Volver a eventos
          </Link>
        </div>
      </main>
    );
  }

  const isConfirmed = order.status === 'confirmed';

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">

      <section className="rounded-2xl bg-white p-6 ring-1 ring-black/5">

        <div className="text-center">       

          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            {isConfirmed
              ? '¡Compra correctamente realizada.!'
              : 'Orden pendiente'}
          </h1>

          <p className="mt-2 text-sm text-ink/70">
            {isConfirmed
              ? ''
              : 'Tu orden todavía no está confirmada.'}
          </p>

        </div>

        <div className="my-8 border-t border-black/10" />

        <div className="space-y-3 text-sm">

          <div className="flex justify-between gap-3">
            <span className="text-ink/60">Número de orden</span>
            <code className="text-right text-xs break-all">
              {order.id}
            </code>
          </div>

          <div className="flex justify-between gap-3">
            <span className="text-ink/60">Evento ID</span>
            <span className="font-medium">
              {order.eventId}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-ink/60">Estado</span>
            <span className="font-semibold">
              {isConfirmed ? 'Confirmada' : 'Pendiente'}
            </span>
          </div>

        </div>

        <div className="my-6 border-t border-black/10" />

        <h2 className="text-lg font-semibold">
          Entradas adquiridas
        </h2>

        <div className="mt-4 space-y-4">

          {order.items.map((item) => (
            <div
              key={item.ticketTypeId}
              className="flex justify-between gap-4 text-sm"
            >
              <div>
                <p className="font-medium">
                  {item.name}
                </p>

                <p className="text-ink/60">
                  {item.quantity} x {formatUsd(item.unitPriceCents)}
                </p>
              </div>

              <span className="font-medium">
                {formatUsd(item.lineTotalCents)}
              </span>
            </div>
          ))}

        </div>

        <div className="my-6 border-t border-black/10" />

        <h2 className="text-lg font-semibold">
          Datos del comprador
        </h2>

        {order.buyer ? (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="text-ink/60">Nombre: </span>
              <strong>{order.buyer.name}</strong>
            </p>

            <p>
              <span className="text-ink/60">Correo: </span>
              <strong>{order.buyer.email}</strong>
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/60">
            No hay datos del comprador disponibles.
          </p>
        )}

        <div className="my-6 border-t border-black/10" />

        <h2 className="text-lg font-semibold">
          Resumen de pago
        </h2>

        <div className="mt-4 space-y-3 text-sm">

          <div className="flex justify-between">
            <span className="text-ink/60">Subtotal</span>
            <span>{formatUsd(order.subtotalCents)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-ink/60">Cargo por servicio</span>
            <span>{formatUsd(order.feeCents)}</span>
          </div>

          <div className="flex justify-between border-t border-black/10 pt-4 text-lg font-semibold">
            <span>Total</span>
            <span>{formatUsd(order.totalCents)}</span>
          </div>

        </div>

      </section>

      <div className="mt-8 text-center">
        <Link
          to="/"
          className="inline-block rounded-xl bg-accent px-6 py-3 font-semibold text-white transition hover:opacity-90"
        >
          Volver a eventos
        </Link>
      </div>

    </main>
  );
}

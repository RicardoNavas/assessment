
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import {
  confirmOrder,
  createOrder,
  useApiMutation,
} from '~/api';

import type {
  ConfirmOrderBody,
  CreateOrderBody,
} from '~/api';

import type { CheckoutState, Order } from '~/types';

import { feeFromSubtotal, formatUsd } from '~/lib/money';

type CheckoutFormValues = {
  name: string;
  email: string;
};

const checkoutSchema = yup.object({
  name: yup
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .matches(
      /^[A-Za-zÁÉÍÓÚáéíóúÜüÑñ\s'-]+$/,
      'Ingresa un nombre válido',
    )
    .required('Ingresa tu nombre'),
  
  
  
  email: yup
    .string()
    .trim()
    .email('Ingresa un correo válido')
    .required('Ingresa tu correo electrónico'),
});

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado. Intenta nuevamente.';
}

/**
 * Confirma una orden después de crearla.
 * Se monta cuando ya conocemos el ID de la orden.
 */

/**
 * Confirma una orden después de crearla.
 * Si falla, permite corregir los datos del comprador
 * y volver a intentar la confirmación.
 */
function ConfirmOrderStep({
  orderId,
  buyer,
  onConfirmed,
}: {
  orderId: string;
  buyer: ConfirmOrderBody;
  onConfirmed: (order: Order) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [buyerData, setBuyerData] = useState<ConfirmOrderBody>(buyer);
  const started = useRef(false);

  const {
    mutateAsync: confirm,
    isPending,
  } = useApiMutation<Order, { id: string }, ConfirmOrderBody>(
    confirmOrder,
    { id: orderId },
  );

  const runConfirmation = useCallback(async () => {
    setError(null);

    try {
      // Validamos nuevamente los datos antes de confirmar.
      const validatedBuyer = await checkoutSchema.validate(buyerData);

      const order = await confirm({
        name: validatedBuyer.name.trim(),
        email: validatedBuyer.email.trim(),
      });

      onConfirmed(order);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [confirm, buyerData, onConfirmed]);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void runConfirmation();
    }
  }, [runConfirmation]);

  return (
    <div className="mt-6 rounded-xl bg-paper p-5">
      {isPending ? (
        <p className="text-sm text-ink/70">
          Confirmando tu compra...
        </p>
      ) : error ? (
        <div>
          <p className="text-sm text-red-600">{error}</p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Nombre completo
              </label>
              <input
                type="text"
                value={buyerData.name}
                onChange={(e) =>
                  setBuyerData({
                    ...buyerData,
                    name: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-line px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Correo electrónico
              </label>
              <input
                type="email"
                value={buyerData.email}
                onChange={(e) =>
                  setBuyerData({
                    ...buyerData,
                    email: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-line px-3 py-2"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={() => void runConfirmation()}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Reintentar confirmación
          </button>
        </div>
      ) : null}
    </div>
  );
}


export function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const selection = location.state as CheckoutState | null;

  const [submitError, setSubmitError] = useState<string | null>(null);

  const [pendingConfirmation, setPendingConfirmation] =
    useState<{
      orderId: string;
      buyer: ConfirmOrderBody;
    } | null>(null);

  const {
    mutateAsync: create,
    isPending: isCreating,
  } = useApiMutation<
    Order,
    Record<string, never>,
    CreateOrderBody
  >(createOrder);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: yupResolver(checkoutSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  });

  const subtotalCents = selection?.items.reduce(
    (total, item) =>
      total + item.unitPriceCents * item.quantity,
    0,
  ) ?? 0;

  const feeCents = feeFromSubtotal(subtotalCents);
  const totalCents = subtotalCents + feeCents;

  const handleConfirmed = useCallback(
    (order: Order) => {
      navigate(`/orders/${order.id}`, { replace: true });
    },
    [navigate],
  );

  const onSubmit = async (values: CheckoutFormValues) => {
    if (!selection) return;

    setSubmitError(null);

    try {
      const order = await create({
        eventId: selection.eventId,
        items: selection.items.map((item) => ({
          ticketTypeId: item.ticketTypeId,
          quantity: item.quantity,
        })),
      });

      setPendingConfirmation({
        orderId: order.id,
        buyer: {
          name: values.name.trim(),
          email: values.email.trim(),
        },
      });
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  };

  if (!selection?.items.length) {
    return <Navigate to="/" replace />;
  }

  const isSubmitting = isCreating || Boolean(pendingConfirmation);

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1fr_280px]">

      <section className="rounded-2xl bg-white p-6 ring-1 ring-black/5">

        <h1 className="text-2xl font-semibold tracking-tight">
          DATOS CLIENTE
        </h1>

        <p className="mt-2 text-sm text-ink/70">
          Completa tu compra para{' '}
          <strong>{selection.eventTitle}</strong>.
        </p>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-8 space-y-5"
        >

          <div>
            <label className="mb-2 block text-sm font-medium">
              Nombre completo
            </label>

            <input
              {...register('name')}
              type="text"
              placeholder="Tu nombre"
              disabled={isSubmitting}
              className="w-full rounded-lg border border-black/10 px-4 py-3 text-sm outline-none focus:border-accent"
            />

            {errors.name && (
              <p className="mt-1 text-sm text-red-600">
                {errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Correo electrónico
            </label>

            <input
              {...register('email')}
              type="email"
              placeholder="correo@ejemplo.com"
              disabled={isSubmitting}
              className="w-full rounded-lg border border-black/10 px-4 py-3 text-sm outline-none focus:border-accent"
            />

            {errors.email && (
              <p className="mt-1 text-sm text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>

          {submitError && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-accent px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating
              ? 'Creando orden...'
              : pendingConfirmation
                ? 'Confirmando compra...'
                : 'Confirmar compra'}
          </button>

        </form>

        {pendingConfirmation && (
          <ConfirmOrderStep
            orderId={pendingConfirmation.orderId}
            buyer={pendingConfirmation.buyer}
            onConfirmed={handleConfirmed}
          />
        )}

      </section>

      <aside className="h-max rounded-2xl bg-white p-5 ring-1 ring-black/5">

        <h2 className="font-semibold">
          Resumen de compra
        </h2>

        <p className="mt-3 text-sm text-ink/60">
          {selection.eventTitle}
        </p>

        <div className="mt-5 space-y-4">

          {selection.items.map((item) => (
            <div
              key={item.ticketTypeId}
              className="flex justify-between gap-3 text-sm"
            >
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-ink/60">
                  {item.quantity} x {formatUsd(item.unitPriceCents)}
                </p>
              </div>

              <span className="font-medium">
                {formatUsd(item.unitPriceCents * item.quantity)}
              </span>
            </div>
          ))}

        </div>

        <div className="my-5 border-t border-black/10" />

        <div className="space-y-3 text-sm">

          <div className="flex justify-between">
            <span className="text-ink/60">Subtotal</span>
            <span>{formatUsd(subtotalCents)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-ink/60">
              Cargo por servicio (10%)
            </span>
            <span>{formatUsd(feeCents)}</span>
          </div>

          <div className="flex justify-between border-t border-black/10 pt-4 text-base font-semibold">
            <span>Total</span>
            <span>{formatUsd(totalCents)}</span>
          </div>

        </div>

      </aside>

    </main>
  );
}

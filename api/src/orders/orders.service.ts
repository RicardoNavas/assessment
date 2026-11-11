import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { APP_STORE } from '../store/store.constants';
import { AppStore, Order } from '../store/store';

/** Service fee applied on top of the ticket subtotal. */
export const SERVICE_FEE_PERCENT = 10;

@Injectable()
export class OrdersService {
  constructor(@Inject(APP_STORE) private readonly store: AppStore) {}

  /**
   * Creates a pending order and holds inventory.
   *
   * The implementation below is intentionally incomplete: the UI can still
   * create orders, but several product rules are missing. See README.md and
   * orders.service.spec.ts.
   */


create(dto: CreateOrderDto): Order {
  if (dto.items.length === 0) {
    throw new BadRequestException(
      'Debes seleccionar al menos una localidad',
    );
  }

  const event = this.store.events.find(
    (item) => item.id === dto.eventId,
  );

  if (!event) {
    throw new NotFoundException('Evento no encontrado');
  }

  // RICARDO NAVAS
  // VALIDACIONES DE CANTIDADES Y LOCALIDADES DUPLICADAS.

  const ticketTypeIds = dto.items.map(
    (line) => line.ticketTypeId,
  );

  if (new Set(ticketTypeIds).size !== ticketTypeIds.length) {
    throw new BadRequestException(
      'No se puede repetir una localidad con la misma orden',
    );
  }

  const items = dto.items.map((line) => {
    const ticketType = event.ticketTypes.find(
      (type) => type.id === line.ticketTypeId,
    );

    if (!ticketType) {
      throw new NotFoundException('Localidad no encontrada');
    }

    if (line.quantity > ticketType.maxPerOrder) {
      throw new BadRequestException(
        `No se puede comprar más de ${ticketType.maxPerOrder} entradas para esta localidad`,
      );
    }

    if (line.quantity > ticketType.remaining) {
      throw new BadRequestException(
        'No hay suficientes entradas disponibles para esta localidad',
      );
    }

    return {
      ticketTypeId: ticketType.id,
      name: ticketType.name,
      quantity: line.quantity,
      unitPriceCents: ticketType.priceCents,
      lineTotalCents: ticketType.priceCents * line.quantity,
    };
  });

  //Ricardo Navas
  //Actualizo inventario.

  for (const item of items) {
    const ticketType = event.ticketTypes.find(
      (type) => type.id === item.ticketTypeId,
    );

    ticketType!.remaining -= item.quantity;
  }

  const subtotalCents = items.reduce(
    (sum, item) => sum + item.lineTotalCents,
    0,
  );

  // TODO: feeCents should be SERVICE_FEE_PERCENT of subtotalCents, rounded

  const feeCents = Math.round(
    (subtotalCents * SERVICE_FEE_PERCENT) / 100,
  );

  const order: Order = {
    id: `ord_${randomUUID()}`,
    eventId: event.id,
    status: 'pending',
    items,
    subtotalCents,
    feeCents,
    totalCents: subtotalCents + feeCents,
    buyer: null,
    createdAt: new Date().toISOString(),
  };

  this.store.orders.set(order.id, order);

  return order;
}


  findById(id: string): Order {
    const order = this.store.orders.get(id);

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    return order;
  }

  confirm(id: string, dto: ConfirmOrderDto): Order {
    const order = this.findById(id);

    // TODO: reject when the order is not pending
     if (order.status !== 'pending') {
       throw new BadRequestException(
      'La orden no se encuentra pendiente de confirmación',
      );
    }   
    
    
    order.status = 'confirmed';
    order.buyer = { name: dto.name, email: dto.email };
    return order;
  }
}

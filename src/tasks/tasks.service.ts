import { Injectable } from '@nestjs/common';
import { TaskStatus } from './task.model';
import { CreateTaskDto } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';
import { WrongTaskStatusException } from './exceptions/wrong-task-status.exception';
import { Task } from './task.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateTaskLabelDto } from './create-task-label.dto';
import { TaskLabel } from './task-label.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(TaskLabel)
    private readonly labelRepository: Repository<TaskLabel>,
  ) {}

  async findAll(): Promise<Task[]> {
    return this.tasksRepository.find();
  }

  async findOne(id: string): Promise<Task | null> {
    return this.tasksRepository.findOne({
      where: { id },
      relations: ['labels'],
    });
  }

  async createTask(createTaskDto: CreateTaskDto): Promise<Task> {
    if (createTaskDto.labels) {
      createTaskDto.labels = this.getUniqueLabels(createTaskDto.labels);
    }
    return this.tasksRepository.save(createTaskDto);
  }

  updateTask(task: Task, updateTaskDto: UpdateTaskDto): Promise<Task> {
    if (
      updateTaskDto.status &&
      !this.isValidStatusTransition(task.status, updateTaskDto.status)
    ) {
      throw new WrongTaskStatusException();
    }

    if (updateTaskDto.labels) {
      updateTaskDto.labels = this.getUniqueLabels(updateTaskDto.labels);
    }

    Object.assign(task, updateTaskDto);
    return this.tasksRepository.save(task);
  }

  async removeLabels(task: Task, labelsToRemove: string[]): Promise<Task> {
    task.labels = task.labels.filter(
      (label) => !labelsToRemove.includes(label.name),
    );
    return this.tasksRepository.save(task);
  }

  async deleteTask(task: Task): Promise<void> {
    await this.tasksRepository.remove(task);
  }

  public async addLabels(
    task: Task,
    labelDtos: CreateTaskLabelDto[],
  ): Promise<Task> {
    const names = new Set(task.labels.map((label) => label.name));
    const labels = this.getUniqueLabels(labelDtos)
      .filter((dto) => !names.has(dto.name))
      .map((label) => this.labelRepository.create(label));

    if (labels.length) {
      task.labels = [...task.labels, ...labels];
      return this.tasksRepository.save(task);
    }

    return task;
  }

  private isValidStatusTransition(
    currentStatus: TaskStatus,
    newStatus: TaskStatus,
  ): boolean {
    const statusOrder = [
      TaskStatus.OPEN,
      TaskStatus.IN_PROGRESS,
      TaskStatus.DONE,
    ];
    return statusOrder.indexOf(currentStatus) <= statusOrder.indexOf(newStatus);
  }

  private getUniqueLabels(
    labelDtos: CreateTaskLabelDto[],
  ): CreateTaskLabelDto[] {
    const uniqueNames = [...new Set(labelDtos.map((label) => label.name))];
    return uniqueNames.map((name) => ({ name }));
  }
}
